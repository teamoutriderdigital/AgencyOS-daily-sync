"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department, IdsStatus, L10Priority, TeamMember } from "./database.types";
import { CANONICAL_IDS } from "./reconcile-ids";

function revalidateDaily() {
  // To-dos and IDS are shared master state shown on both the daily and weekly
  // boards, so refresh both.
  revalidatePath("/daily");
  revalidatePath("/weekly");
}

// ─── Action items (to-dos) ───────────────────────────────────────────────────

export type ActionItemInput = {
  item: string;
  assignee?: TeamMember | null;
  due_date?: string | null;
  priority?: L10Priority | null;
  done?: boolean;
  department?: Department | null;
};

export async function createActionItem(input: ActionItemInput) {
  const supabase = createClient();
  const { error } = await supabase.from("action_items").insert({
    item: input.item,
    assignee: input.assignee ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority ?? null,
    department: input.department ?? null
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateActionItem(id: number, input: Partial<ActionItemInput>) {
  const supabase = createClient();
  const { error } = await supabase.from("action_items").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function toggleActionItemDone(id: number, done: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("action_items").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteActionItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("action_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// ─── IDS items (issues) ──────────────────────────────────────────────────────

export type IdsItemInput = {
  issue: string;
  owner?: TeamMember | null;
  status?: IdsStatus;
  priority?: L10Priority | null;
  client_internal?: string[];
  due_date?: string | null;
  identify?: string | null;
  discuss?: string | null;
  solve?: string | null;
  archived?: boolean;
  department?: Department | null;
  rock_id?: number | null;
};

export async function createIdsItem(input: IdsItemInput) {
  const supabase = createClient();
  const { error } = await supabase.from("ids_items").insert({
    issue: input.issue,
    owner: input.owner ?? null,
    status: input.status ?? "Not started",
    priority: input.priority ?? null,
    client_internal: input.client_internal ?? [],
    due_date: input.due_date ?? null,
    identify: input.identify ?? null,
    discuss: input.discuss ?? null,
    solve: input.solve ?? null,
    department: input.department ?? null,
    rock_id: input.rock_id ?? null
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateIdsItem(id: number, input: Partial<IdsItemInput>) {
  const supabase = createClient();
  const { error } = await supabase.from("ids_items").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteIdsItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("ids_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// Atomic +1 upvote (via the upvote_ids_item RPC so concurrent votes don't race).
export async function upvoteIdsItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.rpc("upvote_ids_item", { item_id: id });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export type ReconcilePlan = {
  toArchive: { id: number; issue: string }[];
  toInsert: string[];
  unchanged: number;
};

// Reconcile live IDS against the rocks: archive open issues not in the canonical
// set, insert any canonical issue missing (matched case-insensitively by text),
// linking each to its rock. Guarded: dryRun returns the plan and mutates nothing.
export async function reconcileIds(dryRun: boolean): Promise<ReconcilePlan> {
  const supabase = createClient();
  const [{ data: open, error: idsErr }, { data: rocks, error: rocksErr }] = await Promise.all([
    supabase.from("ids_items").select("id, issue").eq("archived", false),
    supabase.from("rocks").select("id, title")
  ]);
  if (idsErr) throw new Error(idsErr.message);
  if (rocksErr) throw new Error(rocksErr.message);

  const norm = (s: string) => s.trim().toLowerCase();
  const canonicalSet = new Set(CANONICAL_IDS.map((c) => norm(c.issue)));
  const openByText = new Map((open ?? []).map((o) => [norm(o.issue), o]));

  const toArchive = (open ?? []).filter((o) => !canonicalSet.has(norm(o.issue)));
  const toInsert = CANONICAL_IDS.filter((c) => !openByText.has(norm(c.issue)));
  const plan: ReconcilePlan = {
    toArchive: toArchive.map((o) => ({ id: o.id, issue: o.issue })),
    toInsert: toInsert.map((c) => c.issue),
    unchanged: CANONICAL_IDS.length - toInsert.length
  };
  if (dryRun) return plan;

  const rockIdByTitle = new Map((rocks ?? []).map((r) => [r.title, r.id]));
  for (const o of toArchive) {
    const { error } = await supabase.from("ids_items").update({ archived: true }).eq("id", o.id);
    if (error) throw new Error(error.message);
  }
  for (const c of toInsert) {
    const { error } = await supabase.from("ids_items").insert({
      issue: c.issue,
      owner: c.owner,
      priority: c.priority,
      department: c.department,
      rock_id: c.rockTitle ? rockIdByTitle.get(c.rockTitle) ?? null : null,
      status: "Not started"
    });
    if (error) throw new Error(error.message);
  }
  revalidateDaily();
  return plan;
}

// ─── Weekly carryover ────────────────────────────────────────────────────────
// Roll every still-open to-do / issue from prior weeks forward into the given
// ISO week (records carried_from_week for the badge).
export async function triggerWeeklySync(targetYear: number, targetWeek: number) {
  const supabase = createClient();
  const { error } = await supabase.rpc("sync_weekly_pending_items", {
    target_year: targetYear,
    target_week: targetWeek
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}
