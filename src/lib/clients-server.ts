import { createClient } from "./supabase-server";
import type { Client } from "./clients";

// All clients, ordered for the tracker and the /submit picker. Degrades to an
// empty list when Supabase isn't configured — same posture as the other readers.
export async function getClients(): Promise<Client[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error("getClients failed:", e);
    return [];
  }
}
