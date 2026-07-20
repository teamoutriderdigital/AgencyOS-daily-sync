"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department } from "./database.types";

export type BacklogInput = {
  title?: string;
  detail?: string | null;
  department?: Department | null;
};

function revalidateWeekly() {
  revalidatePath("/weekly");
}

// Manual add only — source defaults to 'manual'. Fathom-sourced rows arrive in
// Phase 3 via a dedicated action, not this one.
export async function createBacklogItem(input: BacklogInput) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").insert({
    title: input.title ?? "",
    detail: input.detail ?? null,
    department: input.department ?? null
  });
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function updateBacklogItem(id: number, input: BacklogInput) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function setBacklogReviewed(id: number, reviewed: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").update({ reviewed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function deleteBacklogItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}
