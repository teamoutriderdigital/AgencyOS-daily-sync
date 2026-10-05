"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department, IdsStatus, L10Priority, TeamMember } from "./database.types";
import { CANONICAL_IDS } from "./reconcile-ids";
import { boardToday } from "./subprojects";
import { OWNERS } from "./team";
import { offTrackIssueTitle, ratingIssueTitle, ratingNeedsReason, solveTodoProblem, solvedNote } from "./l10-rules";

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
  const { error } = await supabase
    .from("action_items")
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
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
  const patch: Partial<IdsItemInput> & { completed_at?: string | null } = { ...input };
  // Stamp when an issue closes (Solved or archived); clear when it reopens.
  if (input.status !== undefined || input.archived !== undefined) {
    const closing = input.status === "Solved" || input.archived === true;
    const reopening = input.status !== undefined && input.status !== "Solved" && input.archived !== true;
    if (closing) patch.completed_at = new Date().toISOString();
    else if (reopening || input.archived === false) patch.completed_at = null;
  }
  const { error } = await supabase.from("ids_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteIdsItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("ids_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// Rule 1: an issue only closes with a to-do behind it. Creates the to-do, then
// marks the issue Solved and archives it, recording the to-do in its notes.
export async function solveIdsItem(
  id: number,
  todo: { item: string; assignee: TeamMember | null; due_date: string | null }
) {
  const problem = solveTodoProblem(todo, boardToday());
  if (problem) throw new Error(problem);
  const supabase = createClient();
  const { data: issue, error: readErr } = await supabase.from("ids_items").select("solve").eq("id", id).single();
  if (readErr) throw new Error(readErr.message);
  const { error: todoErr } = await supabase.from("action_items").insert({
    item: todo.item.trim(),
    assignee: todo.assignee,
    due_date: todo.due_date
  });
  if (todoErr) throw new Error(todoErr.message);
  const note = solvedNote({ item: todo.item, assignee: todo.assignee as string, due_date: todo.due_date as string });
  const { error } = await supabase
    .from("ids_items")
    .update({
      status: "Solved",
      archived: true,
      completed_at: new Date().toISOString(),
      solve: issue?.solve ? `${issue.solve}\n${note}` : note
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// Rule 2: a rating under 8 comes with a reason, filed as an issue owned by the
// person who gave it, so next week's meeting opens with it.
export async function fileRatingReason(input: { member: TeamMember; rating: number; reason: string }) {
  if (!ratingNeedsReason(input.rating)) throw new Error("Only ratings under 8 need a reason.");
  if (!input.reason.trim()) throw new Error("Say why.");
  const supabase = createClient();
  const { error } = await supabase.from("ids_items").insert({
    issue: ratingIssueTitle(input.member, input.rating, input.reason),
    owner: input.member,
    status: "Not started",
    identify: input.reason.trim(),
    client_internal: []
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// Rule 3: an off-track rock becomes an issue linked to it. Idempotent: if the
// rock already has an open issue, nothing new is created.
export async function sendRockToIssues(rock: { id: number; title: string; owner: string | null }) {
  const supabase = createClient();
  const { data: open, error: readErr } = await supabase
    .from("ids_items")
    .select("id")
    .eq("rock_id", rock.id)
    .eq("archived", false)
    .neq("status", "Solved")
    .limit(1);
  if (readErr) throw new Error(readErr.message);
  if (open && open.length > 0) return { created: false };
  const { error } = await supabase.from("ids_items").insert({
    issue: offTrackIssueTitle(rock.title),
    owner: rock.owner && (OWNERS as string[]).includes(rock.owner) ? (rock.owner as TeamMember) : null,
    status: "Not started",
    rock_id: rock.id,
    client_internal: []
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
  return { created: true };
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
