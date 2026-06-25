"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Browser client — also the realtime transport. No auth session is persisted;
// this is an internal tool gated at the deployment layer.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );
}
