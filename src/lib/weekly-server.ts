import { createClient } from "./supabase-server";
import type { ActionItem, IdsItem } from "./l10";
import type { Rock } from "./rocks";
import type { MeetingRating } from "./daily";
import { currentIsoWeek, isoWeekStart } from "./weekly";
import type { Innovation } from "./innovations";
import type { ItemSummary } from "./summaries";
import type { SalesDeal } from "./sales";

export type WeeklySnapshot = {
  actionItems: ActionItem[];
  idsItems: IdsItem[];
  rocks: Rock[];
  // Meeting ratings for the current week (keyed by the week's Monday). The board
  // refetches this when you navigate to a different week.
  ratings: MeetingRating[];
  innovations: Innovation[];
  summaries: ItemSummary[];
  // The sales pipeline — a master list shared with the daily board (not
  // date-scoped), so the L10 reviews the same deals the daily sync edits.
  salesDeals: SalesDeal[];
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
    ratings: [],
    innovations: [],
    summaries: [],
    salesDeals: []
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
    const [
      actionResp,
      idsResp,
      rocksResp,
      ratingsResp,
      innovationsResp,
      summariesResp,
      salesResp
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
      supabase.from("meeting_ratings").select("*").eq("rating_date", ratingDate),
      supabase.from("innovations").select("*").order("created_at", { ascending: false }),
      supabase
        .from("item_summaries")
        .select("*")
        .eq("week_number", cur.week)
        .eq("year_number", cur.year),
      // Master pipeline (not date-scoped) — same ordering as the daily board.
      supabase.from("sales_deals").select("*").order("created_at", { ascending: true })
    ]);
    if (actionResp.error) throw new Error(actionResp.error.message);
    if (idsResp.error) throw new Error(idsResp.error.message);
    if (rocksResp.error) throw new Error(rocksResp.error.message);
    // Non-fatal: if migration 009 (meeting_ratings) isn't applied yet, render
    // the board rather than blanking it — just skip the ratings.
    if (ratingsResp.error) {
      console.error("meeting_ratings unavailable (run migration 009?):", ratingsResp.error.message);
    }
    if (innovationsResp.error) console.error("innovations unavailable (run migration 013?):", innovationsResp.error.message);
    if (summariesResp.error) console.error("item_summaries unavailable (run migration 015?):", summariesResp.error.message);
    if (salesResp.error) console.error("sales_deals unavailable (run migration 016?):", salesResp.error.message);
    return {
      actionItems: actionResp.data ?? [],
      idsItems: idsResp.data ?? [],
      rocks: rocksResp.data ?? [],
      ratings: ratingsResp.error ? [] : ratingsResp.data ?? [],
      innovations: innovationsResp.error ? [] : innovationsResp.data ?? [],
      summaries: summariesResp.error ? [] : summariesResp.data ?? [],
      salesDeals: salesResp.error ? [] : (salesResp.data as SalesDeal[]) ?? []
    };
  } catch (e) {
    console.error("getWeeklySnapshot failed — rendering empty board:", e);
    return emptySnapshot();
  }
}
