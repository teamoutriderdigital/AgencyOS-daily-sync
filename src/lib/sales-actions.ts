"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { SalesStage, TeamMember } from "./database.types";

export type SalesDealInput = {
  name?: string;
  value?: number | null;
  stage?: SalesStage;
  owner?: TeamMember | null;
  expected_close?: string | null;
  notes?: string | null;
};

// The pipeline renders on both the daily board and the weekly L10, so an edit
// made on one has to invalidate the other's cached render too.
function revalidateSales() {
  revalidatePath("/daily");
  revalidatePath("/weekly");
}

export async function createSalesDeal(input: SalesDealInput) {
  const supabase = createClient();
  const { error } = await supabase.from("sales_deals").insert({
    name: input.name ?? "",
    value: input.value ?? null,
    stage: input.stage ?? "Lead",
    owner: input.owner ?? null,
    expected_close: input.expected_close ?? null,
    notes: input.notes ?? null
  });
  if (error) throw new Error(error.message);
  revalidateSales();
}

export async function updateSalesDeal(id: number, input: SalesDealInput) {
  const supabase = createClient();
  const { error } = await supabase.from("sales_deals").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateSales();
}

export async function deleteSalesDeal(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("sales_deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateSales();
}
