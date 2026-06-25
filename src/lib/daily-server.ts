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

// Every distinct client ever used in a headline, so they persist as default
// chips for everyone. Degrades to an empty list when Supabase isn't configured.
export async function getKnownClients(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("daily_headlines")
      .select("client")
      .not("client", "is", null);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const row of data ?? []) {
      if (row.client) set.add(row.client);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error("getKnownClients failed:", e);
    return [];
  }
}

// Headlines for a single date — used by the dashboard's "today's headlines"
// panel. Degrades to an empty list when Supabase isn't configured.
export async function getHeadlines(date: string): Promise<DailyHeadline[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("daily_headlines")
      .select("*")
      .eq("headline_date", date)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error("getHeadlines failed:", e);
    return [];
  }
}
