"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department, RockStatus, RockType } from "./database.types";
import {
  QUARTER,
  SEED_ROCKS,
  nextQuarter,
  reviewCarryKey,
  reviewPrevStatusKey,
  reviewStartedKey,
  type RockSeed
} from "./rocks";

function revalidateRocks() {
  // Rocks are edited on the Finalize board (/rocks) and status-tracked on the
  // weekly board (/weekly) — refresh both.
  revalidatePath("/rocks");
  revalidatePath("/weekly");
  revalidatePath("/quarterly");
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
  const { error } = await supabase
    .from("rocks")
    .update({ status, completed_at: status === "Done" ? new Date().toISOString() : null })
    .eq("id", id);
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

// ─── End-of-quarter review (/quarterly) ──────────────────────────────────────

// The review's Done tick. Ticking sets the rock Done and remembers the status it
// had, so an accidental tick on an Off track rock can be undone cleanly.
export async function setReviewDone(rockId: number, quarter: string, done: boolean) {
  const supabase = createClient();
  const prevKey = reviewPrevStatusKey(quarter, rockId);
  if (done) {
    const { data: rock, error: readErr } = await supabase.from("rocks").select("status").eq("id", rockId).single();
    if (readErr) throw new Error(readErr.message);
    if (rock.status !== "Done") {
      const { error: kvErr } = await supabase
        .from("rock_meeting_kv")
        .upsert({ key: prevKey, text_value: rock.status }, { onConflict: "key" });
      if (kvErr) throw new Error(kvErr.message);
    }
    await setRockStatus(rockId, "Done");
    return;
  }
  const { data: prev } = await supabase.from("rock_meeting_kv").select("text_value").eq("key", prevKey).maybeSingle();
  const restore = prev?.text_value === "Off track" ? "Off track" : "On track";
  await setRockStatus(rockId, restore);
}

// The review's Carry tick.
export async function setReviewCarry(rockId: number, quarter: string, carry: boolean) {
  await setMeetingValue(reviewCarryKey(quarter, rockId), { checked: carry });
}

// Copy every rock ticked "Carry" into the next quarter as a fresh On track rock
// (same owner, goal, type, department; progress reset). Refuses if the next
// quarter already has rocks, so a double click can't duplicate them.
export async function startNextQuarter(quarter: string): Promise<{ nextQuarter: string; carried: number }> {
  const supabase = createClient();
  const target = nextQuarter(quarter);

  const { count, error: countErr } = await supabase
    .from("rocks")
    .select("id", { count: "exact", head: true })
    .eq("quarter", target);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) throw new Error(`${target} already has ${count} rocks — nothing copied.`);

  const [{ data: rocks, error: rocksErr }, { data: kv, error: kvErr }] = await Promise.all([
    supabase.from("rocks").select("*").eq("quarter", quarter).order("sort_order", { ascending: true }),
    supabase.from("rock_meeting_kv").select("key, checked").like("key", `review:${quarter}:carry:%`)
  ]);
  if (rocksErr) throw new Error(rocksErr.message);
  if (kvErr) throw new Error(kvErr.message);

  const carryIds = new Set(
    (kv ?? []).filter((row) => row.checked).map((row) => Number(row.key.split(":").pop()))
  );
  const payload = (rocks ?? [])
    .filter((r) => carryIds.has(r.id))
    .map((r, i) => ({
      title: r.title,
      owner: r.owner,
      rock_type: r.rock_type,
      smart: r.smart,
      department: r.department,
      quarter: target,
      status: "On track" as const,
      sort_order: i
    }));
  if (payload.length === 0) throw new Error("No rocks are ticked Carry — nothing to start.");

  const { error: insErr } = await supabase.from("rocks").insert(payload);
  if (insErr) throw new Error(insErr.message);
  await setMeetingValue(reviewStartedKey(quarter), {
    checked: true,
    text_value: `${payload.length} rocks carried into ${target} on ${new Date().toISOString().slice(0, 10)}`
  });
  revalidateRocks();
  return { nextQuarter: target, carried: payload.length };
}
