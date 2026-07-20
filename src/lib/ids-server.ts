import { createClient } from "./supabase-server";
import type { IdsItem } from "./l10";

// Open IDS items for the public /submit page, so submitters can see what's
// already in the queue and upvote it instead of filing a duplicate. Same filter
// and order as the weekly board's IDS read (archived = false, newest first).
// Degrades to an empty list when Supabase isn't configured — same posture as
// getClients.
export async function getOpenIdsItems(): Promise<IdsItem[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ids_items")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error("getOpenIdsItems failed:", e);
    return [];
  }
}
