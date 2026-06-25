import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server client for the server component reader and server actions. Stateless
// (no cookies / session) — uses the anon/publishable key against permissive RLS.
//
// supabase-js calls fetch() internally, and the Next.js App Router caches
// fetch() by default — which would freeze server reads at their first result.
// Force every server-side read fresh with cache: "no-store".
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
    {
      auth: { persistSession: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" })
      }
    }
  );
}
