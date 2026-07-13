import { createClient } from "./supabase-server";
import type { ActionItem, IdsItem } from "./l10";
import type { Rock } from "./rocks";
import type { Client } from "./clients";
import type { MeetingRating } from "./daily";
import { currentIsoWeek, isoWeekStart } from "./weekly";

export type WeeklySnapshot = {
  actionItems: ActionItem[];
  idsItems: IdsItem[];
  rocks: Rock[];
  clients: Client[];
  // Meeting ratings for the current week (keyed by the week's Monday). The board
  // refetches this when you navigate to a different week.
  ratings: MeetingRating[];
};

// The date a week's meeting rating is stored under: that week's Monday (UTC).
export function weekRatingDate(year: number, week: number): string {
  return isoWeekStart(year, week).toISOString().slice(0, 10);
}

function emptySnapshot(): WeeklySnapshot {
  return { actionItems: [], idsItems: [], rocks: [], clients: [], ratings: [] };
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
    const [actionResp, idsResp, rocksResp, clientsResp, ratingsResp] = await Promise.all([
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
      supabase.from("meeting_ratings").select("*").eq("rating_date", ratingDate)
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
    return {
      actionItems: actionResp.data ?? [],
      idsItems: idsResp.data ?? [],
      rocks: rocksResp.data ?? [],
      clients: clientsResp.data ?? [],
      ratings: ratingsResp.error ? [] : ratingsResp.data ?? []
    };
  } catch (e) {
    console.error("getWeeklySnapshot failed — rendering empty board:", e);
    return emptySnapshot();
  }
}
