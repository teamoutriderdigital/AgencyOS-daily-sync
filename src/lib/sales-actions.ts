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
};

function revalidateDaily() {
  revalidatePath("/daily");
}

export async function createSalesDeal(input: SalesDealInput) {
  const supabase = createClient();
  const { error } = await supabase.from("sales_deals").insert({
    name: input.name ?? "",
    value: input.value ?? null,
    stage: input.stage ?? "Lead",
    owner: input.owner ?? null,
    expected_close: input.expected_close ?? null
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateSalesDeal(id: number, input: SalesDealInput) {
  const supabase = createClient();
  const { error } = await supabase.from("sales_deals").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteSalesDeal(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("sales_deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}
