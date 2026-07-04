import { createClient } from "./supabase-server";
import type { Rock, RockKv } from "./rocks";

export type RocksSnapshot = {
  rocks: Rock[];
  kv: RockKv[];
};

function emptySnapshot(): RocksSnapshot {
  return { rocks: [], kv: [] };
}

// Load the rocks-meeting board. Degrades to an empty board when Supabase isn't
// configured or errors, so the page renders (with its static agenda + seed
// button) rather than crashing — same posture as getDailySnapshot.
export async function getRocksSnapshot(): Promise<RocksSnapshot> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return emptySnapshot();
  }
  try {
    const supabase = createClient();
    const [rocksResp, kvResp] = await Promise.all([
      supabase
        .from("rocks")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("rock_meeting_kv").select("*")
    ]);
    if (rocksResp.error) throw new Error(rocksResp.error.message);
    if (kvResp.error) throw new Error(kvResp.error.message);
    return { rocks: rocksResp.data ?? [], kv: kvResp.data ?? [] };
  } catch (e) {
    console.error("getRocksSnapshot failed — rendering empty board:", e);
    return emptySnapshot();
  }
}
