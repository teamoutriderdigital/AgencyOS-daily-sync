"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department, RockStatus, RockType } from "./database.types";
import { QUARTER, SEED_ROCKS, type RockSeed } from "./rocks";

function revalidateRocks() {
  // Rocks are edited on the Finalize board (/rocks) and status-tracked on the
  // weekly board (/weekly) — refresh both.
  revalidatePath("/rocks");
  revalidatePath("/weekly");
}

// ─── Rocks (the deliverable) ─────────────────────────────────────────────────

export type RockInput = {
  title?: string;
  owner?: string | null;
  rock_type?: RockType;
  smart?: string | null;
  deadline?: string | null;
  sort_order?: number;
  status?: RockStatus;
  quarter?: string;
  department?: Department | null;
  progress_note?: string | null;
};

export async function createRock(input: RockInput) {
  const supabase = createClient();
  const { error } = await supabase.from("rocks").insert({
    title: input.title ?? "",
    owner: input.owner ?? null,
    rock_type: input.rock_type ?? "company",
    smart: input.smart ?? null,
    deadline: input.deadline ?? null,
    sort_order: input.sort_order ?? 0,
    department: input.department ?? null,
    progress_note: input.progress_note ?? null
  });
  if (error) throw new Error(error.message);
  revalidateRocks();
}

export async function updateRock(id: number, input: RockInput) {
  const supabase = createClient();
  const { error } = await supabase.from("rocks").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRocks();
}

export async function deleteRock(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("rocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRocks();
}

// Weekly tracker: flip a rock's On track / Off track / Done status.
export async function setRockStatus(id: number, status: RockStatus) {
  const supabase = createClient();
  const { error } = await supabase.from("rocks").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRocks();
}

// Bulk-load the draft rocks from the brain-dump. Only runs when the table is
// empty (guarded by the caller's empty state) so it can't double-seed.
export async function seedRocks(rows: RockSeed[]) {
  const supabase = createClient();
  const payload = rows.map((r, i) => ({
    title: r.title,
    owner: r.owner,
    rock_type: r.rock_type,
    department: r.department,
    progress_note: r.progress_note,
    status: r.status ?? "On track",
    quarter: QUARTER,
    smart: r.smart,
    sort_order: i
  }));
  const { error } = await supabase.from("rocks").insert(payload);
  if (error) throw new Error(error.message);
  revalidateRocks();
}

// Replace the current-quarter rocks with the seed list. Guarded: dryRun returns
// the plan and mutates nothing. A real run deletes only this quarter's rocks
// (leaving other quarters intact), then inserts the seed. Operator-triggered.
export async function resetAndSeedRocks(dryRun: boolean): Promise<{ willDelete: number; willInsert: number }> {
  const supabase = createClient();
  const { data: existing, error: readErr } = await supabase
    .from("rocks")
    .select("id")
    .eq("quarter", QUARTER);
  if (readErr) throw new Error(readErr.message);
  const plan = { willDelete: existing?.length ?? 0, willInsert: SEED_ROCKS.length };
  if (dryRun) return plan;

  const { error: delErr } = await supabase.from("rocks").delete().eq("quarter", QUARTER);
  if (delErr) throw new Error(delErr.message);
  await seedRocks(SEED_ROCKS);
  revalidateRocks();
  return plan;
}

// ─── Keyed meeting state (decisions, collisions, checklist, facilitator) ─────
// Partial upsert keyed on `key`: writing only text_value or only checked leaves
// the other column intact, so locking a decision never clears its written call.

export async function setMeetingValue(
  key: string,
  patch: { text_value?: string | null; checked?: boolean }
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("rock_meeting_kv")
    .upsert({ key, ...patch }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidateRocks();
}
