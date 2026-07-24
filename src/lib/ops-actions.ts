"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { OpsStatus, TeamMember } from "./database.types";

export type OpsTaskInput = {
  title?: string;
  owner?: TeamMember | null;
  status?: OpsStatus;
};

function revalidateDaily() {
  revalidatePath("/daily");
}

export async function createOpsTask(input: OpsTaskInput) {
  const supabase = createClient();
  const { error } = await supabase.from("ops_tasks").insert({
    title: input.title ?? "",
    owner: input.owner ?? null,
    status: input.status ?? "Open"
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateOpsTask(id: number, input: OpsTaskInput) {
  const supabase = createClient();
  const { error } = await supabase.from("ops_tasks").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteOpsTask(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("ops_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}
