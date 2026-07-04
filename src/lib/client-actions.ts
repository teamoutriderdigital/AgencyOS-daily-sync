"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { ClientStage } from "./database.types";

function revalidateClients() {
  // Clients drive the weekly stage tracker and the /submit client picker.
  revalidatePath("/weekly");
  revalidatePath("/submit");
}

export type ClientInput = {
  name?: string;
  stage?: ClientStage;
  owner?: string | null;
  notes?: string | null;
  sort_order?: number;
};

export async function addClient(input: { name: string; sort_order?: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("Client name is required");
  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .insert({ name, sort_order: input.sort_order ?? 0 });
  if (error) throw new Error(error.message);
  revalidateClients();
}

export async function updateClient(id: number, input: ClientInput) {
  const supabase = createClient();
  const patch: ClientInput = { ...input };
  if (typeof patch.name === "string") patch.name = patch.name.trim();
  const { error } = await supabase.from("clients").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateClients();
}

export async function setClientStage(id: number, stage: ClientStage) {
  const supabase = createClient();
  const { error } = await supabase.from("clients").update({ stage }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateClients();
}

export async function deleteClient(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateClients();
}
