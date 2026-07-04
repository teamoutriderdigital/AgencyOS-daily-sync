import { createClient } from "./supabase-server";
import type { ActionItem, IdsItem } from "./l10";
import type { Rock } from "./rocks";
import type { Client } from "./clients";

export type WeeklySnapshot = {
  actionItems: ActionItem[];
  idsItems: IdsItem[];
  rocks: Rock[];
  clients: Client[];
};

function emptySnapshot(): WeeklySnapshot {
  return { actionItems: [], idsItems: [], rocks: [], clients: [] };
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
    const [actionResp, idsResp, rocksResp, clientsResp] = await Promise.all([
      supabase
        .from("action_items")
        .select("*")
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase.from("ids_items").select("*").eq("archived", false).order("created_at", { ascending: true }),
      supabase
        .from("rocks")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("clients")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    ]);
    if (actionResp.error) throw new Error(actionResp.error.message);
    if (idsResp.error) throw new Error(idsResp.error.message);
    if (rocksResp.error) throw new Error(rocksResp.error.message);
    if (clientsResp.error) throw new Error(clientsResp.error.message);
    return {
      actionItems: actionResp.data ?? [],
      idsItems: idsResp.data ?? [],
      rocks: rocksResp.data ?? [],
      clients: clientsResp.data ?? []
    };
  } catch (e) {
    console.error("getWeeklySnapshot failed — rendering empty board:", e);
    return emptySnapshot();
  }
}
