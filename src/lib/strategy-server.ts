import { createClient } from "./supabase-server";
import type { StrategyActionItem, StrategyMeeting } from "./strategy";

export type StrategySnapshot = {
  month: string;
  meetings: StrategyMeeting[];
  actions: StrategyActionItem[];
};

function emptySnapshot(month: string): StrategySnapshot {
  return { month, meetings: [], actions: [] };
}

// One month's strategy meetings + their action items. Degrades to an empty
// board when Supabase isn't configured (or the migration hasn't been applied
// yet) — same posture as the daily reader.
export async function getStrategySnapshot(month: string): Promise<StrategySnapshot> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return emptySnapshot(month);
  }

  try {
    const supabase = createClient();
    const [meetingsResp, actionsResp] = await Promise.all([
      supabase.from("strategy_meetings").select("*").eq("month", month),
      supabase
        .from("strategy_actions")
        .select("*")
        .eq("month", month)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    ]);
    if (meetingsResp.error) throw new Error(meetingsResp.error.message);
    if (actionsResp.error) throw new Error(actionsResp.error.message);
    return { month, meetings: meetingsResp.data ?? [], actions: actionsResp.data ?? [] };
  } catch (e) {
    console.error("getStrategySnapshot failed — rendering empty board:", e);
    return emptySnapshot(month);
  }
}
