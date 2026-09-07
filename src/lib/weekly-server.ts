import { createClient } from "./supabase-server";
import type { ActionItem, IdsItem } from "./l10";
import type { Rock } from "./rocks";
import type { Client } from "./clients";
import type { MeetingRating, DailyHeadline, HeadlineTask } from "./daily";
import { currentIsoWeek, isoWeekStart } from "./weekly";
import type { Innovation } from "./innovations";
import type { ItemSummary } from "./summaries";
import type { SalesDeal } from "./sales";

export type WeeklySnapshot = {
  actionItems: ActionItem[];
  idsItems: IdsItem[];
  rocks: Rock[];
  clients: Client[];
  // Meeting ratings for the current week (keyed by the week's Monday). The board
  // refetches this when you navigate to a different week.
  ratings: MeetingRating[];
  innovations: Innovation[];
  summaries: ItemSummary[];
  // The sales pipeline — a master list shared with the daily board (not
  // date-scoped), so the L10 reviews the same deals the daily sync edits.
  salesDeals: SalesDeal[];
  // The most recent daily meeting's client headlines + per-bullet tasks, mirrored
  // read-only onto the weekly L10 so the room reviews the last daily's client
  // update (headline → tasks → responsible). `headlinesDate` is that day.
  dailyHeadlines: DailyHeadline[];
  headlineTasks: HeadlineTask[];
  headlinesDate: string | null;
};

// The date a week's meeting rating is stored under: that week's Monday (UTC).
export function weekRatingDate(year: number, week: number): string {
  return isoWeekStart(year, week).toISOString().slice(0, 10);
}

function emptySnapshot(): WeeklySnapshot {
  return {
    actionItems: [],
    idsItems: [],
    rocks: [],
    clients: [],
    ratings: [],
    innovations: [],
    summaries: [],
    salesDeals: [],
    dailyHeadlines: [],
    headlineTasks: [],
    headlinesDate: null
  };
}

// The weekly L10 board loads the same open master lists as the daily board (the
// board filters them to the selected ISO week client-side) plus the rocks for
// the per-owner tracker. Degrades to empty when Supabase isn't configured.
export async function getWeeklySnapshot(): Promise<WeeklySnapshot> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return emptySnapshot();
  }
  try {
    const supabase = createClient();
    const cur = currentIsoWeek();
    const ratingDate = weekRatingDate(cur.year, cur.week);
    // The most recent daily meeting that has client headlines (usually the last
    // working day). We mirror that day's headlines + tasks onto the weekly board.
    const latestHeadline = await supabase
      .from("daily_headlines")
      .select("headline_date")
      .order("headline_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const headlinesDate = latestHeadline.data?.headline_date ?? null;
    const emptyResp = Promise.resolve({ data: [], error: null } as const);
    const [
      actionResp,
      idsResp,
      rocksResp,
      clientsResp,
      ratingsResp,
      innovationsResp,
      summariesResp,
      salesResp,
      headlinesResp,
      headlineTasksResp
    ] = await Promise.all([
      supabase
        .from("action_items")
        .select("*")
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase.from("ids_items").select("*").eq("archived", false).order("created_at", { ascending: false }),
      supabase
        .from("rocks")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("clients")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("meeting_ratings").select("*").eq("rating_date", ratingDate),
      supabase.from("innovations").select("*").order("created_at", { ascending: false }),
      supabase
        .from("item_summaries")
        .select("*")
        .eq("week_number", cur.week)
        .eq("year_number", cur.year),
      // Master pipeline (not date-scoped) — same ordering as the daily board.
      supabase.from("sales_deals").select("*").order("created_at", { ascending: true }),
      headlinesDate
        ? supabase.from("daily_headlines").select("*").eq("headline_date", headlinesDate).order("created_at", { ascending: true })
        : emptyResp,
      headlinesDate
        ? supabase.from("headline_tasks").select("*").eq("headline_date", headlinesDate).order("sort_order", { ascending: true })
        : emptyResp
    ]);
    if (actionResp.error) throw new Error(actionResp.error.message);
    if (idsResp.error) throw new Error(idsResp.error.message);
    if (rocksResp.error) throw new Error(rocksResp.error.message);
    if (clientsResp.error) throw new Error(clientsResp.error.message);
    // Non-fatal: if migration 009 (meeting_ratings) isn't applied yet, render
    // the board rather than blanking it — just skip the ratings.
    if (ratingsResp.error) {
      console.error("meeting_ratings unavailable (run migration 009?):", ratingsResp.error.message);
    }
    if (innovationsResp.error) console.error("innovations unavailable (run migration 013?):", innovationsResp.error.message);
    if (summariesResp.error) console.error("item_summaries unavailable (run migration 015?):", summariesResp.error.message);
    if (salesResp.error) console.error("sales_deals unavailable (run migration 016?):", salesResp.error.message);
    if (headlinesResp.error) console.error("daily_headlines unavailable:", headlinesResp.error.message);
    if (headlineTasksResp.error) console.error("headline_tasks unavailable:", headlineTasksResp.error.message);
    return {
      actionItems: actionResp.data ?? [],
      idsItems: idsResp.data ?? [],
      rocks: rocksResp.data ?? [],
      clients: clientsResp.data ?? [],
      ratings: ratingsResp.error ? [] : ratingsResp.data ?? [],
      innovations: innovationsResp.error ? [] : innovationsResp.data ?? [],
      summaries: summariesResp.error ? [] : summariesResp.data ?? [],
      salesDeals: salesResp.error ? [] : (salesResp.data as SalesDeal[]) ?? [],
      dailyHeadlines: headlinesResp.error ? [] : (headlinesResp.data as DailyHeadline[]) ?? [],
      headlineTasks: headlineTasksResp.error ? [] : (headlineTasksResp.data as HeadlineTask[]) ?? [],
      headlinesDate
    };
  } catch (e) {
    console.error("getWeeklySnapshot failed — rendering empty board:", e);
    return emptySnapshot();
  }
}
