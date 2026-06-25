import { createClient } from "./supabase-server";
import type { ActionItem } from "./l10";

// All to-dos (open + done) for the dashboard overview, in the same order the
// daily board uses. Degrades to an empty list when Supabase isn't configured
// yet so the page still renders.
export async function getTodoOverview(): Promise<ActionItem[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("action_items")
      .select("*")
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error("getTodoOverview failed — rendering empty dashboard:", e);
    return [];
  }
}
