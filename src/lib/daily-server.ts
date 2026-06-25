import { createClient } from "./supabase-server";
import type { ActionItem, IdsItem } from "./l10";
import type { DailyCheckin, DailyHeadline } from "./daily";

export type DailySnapshot = {
  date: string;
  checkins: DailyCheckin[];
  headlines: DailyHeadline[];
  actionItems: ActionItem[];
  idsItems: IdsItem[];
};

function emptySnapshot(date: string): DailySnapshot {
  return { date, checkins: [], headlines: [], actionItems: [], idsItems: [] };
}

export async function getDailySnapshot(date: string): Promise<DailySnapshot> {
  // Render the board even when Supabase isn't configured yet (e.g. local
  // preview before env is set) — show empty sections rather than crashing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return emptySnapshot(date);
  }

  try {
    return await loadSnapshot(date);
  } catch (e) {
    console.error("getDailySnapshot failed — rendering empty board:", e);
    return emptySnapshot(date);
  }
}

async function loadSnapshot(date: string): Promise<DailySnapshot> {
  const supabase = createClient();

  const [checkinsResp, headlinesResp, actionResp, idsResp] = await Promise.all([
    supabase.from("daily_checkins").select("*").eq("checkin_date", date),
    supabase
      .from("daily_headlines")
      .select("*")
      .eq("headline_date", date)
      .order("created_at", { ascending: true }),
    // Open items first, then by due date, then by creation — the L10 ordering.
    supabase
      .from("action_items")
      .select("*")
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("ids_items")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true })
  ]);

  if (checkinsResp.error) throw new Error(checkinsResp.error.message);
  if (headlinesResp.error) throw new Error(headlinesResp.error.message);
  if (actionResp.error) throw new Error(actionResp.error.message);
  if (idsResp.error) throw new Error(idsResp.error.message);

  return {
    date,
    checkins: checkinsResp.data ?? [],
    headlines: headlinesResp.data ?? [],
    actionItems: actionResp.data ?? [],
    idsItems: idsResp.data ?? []
  };
}
