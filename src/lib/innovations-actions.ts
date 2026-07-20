"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department } from "./database.types";

export type InnovationInput = {
  title?: string;
  url?: string | null;
  found_by?: string | null;
  note?: string | null;
  department?: Department | null;
};

function revalidateWeekly() {
  revalidatePath("/weekly");
}

export async function createInnovation(input: InnovationInput) {
  const supabase = createClient();
  const { error } = await supabase.from("innovations").insert({
    title: input.title ?? "",
    url: input.url ?? null,
    found_by: input.found_by ?? null,
    note: input.note ?? null,
    department: input.department ?? null
  });
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function updateInnovation(id: number, input: InnovationInput) {
  const supabase = createClient();
  const { error } = await supabase.from("innovations").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function deleteInnovation(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("innovations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}
