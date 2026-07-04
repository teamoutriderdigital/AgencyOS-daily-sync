"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { IdsStatus, L10Priority, TeamMember } from "./database.types";

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
};

export async function createActionItem(input: ActionItemInput) {
  const supabase = createClient();
  const { error } = await supabase.from("action_items").insert({
    item: input.item,
    assignee: input.assignee ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority ?? null
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
    solve: input.solve ?? null
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
