"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { TeamMember } from "./database.types";

export type StrategyActionInput = {
  text?: string;
  owner?: TeamMember | null;
  done?: boolean;
  sort_order?: number;
};

// A meeting row is created lazily the first time anyone writes notes or adds
// an action for a (client, month) — the board renders a card per client
// whether or not a row exists yet. Upserting only client+month is a no-op on
// conflict, so it never clobbers notes typed by someone else.
async function ensureMeeting(client: string, month: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_meetings")
    .upsert({ client, month }, { onConflict: "client,month" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function saveStrategyNotes(client: string, month: string, notes: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("strategy_meetings")
    .upsert({ client, month, notes: notes || null }, { onConflict: "client,month" });
  if (error) throw new Error(error.message);
  revalidatePath("/strategy");
}

export async function createStrategyAction(
  client: string,
  month: string,
  input: StrategyActionInput
) {
  const meetingId = await ensureMeeting(client, month);
  const supabase = createClient();
  const { error } = await supabase.from("strategy_actions").insert({
    meeting_id: meetingId,
    client,
    month,
    text: input.text ?? "",
    owner: input.owner ?? null,
    done: input.done ?? false,
    sort_order: input.sort_order ?? 0
  });
  if (error) throw new Error(error.message);
  revalidatePath("/strategy");
}

export async function updateStrategyAction(id: number, input: StrategyActionInput) {
  const supabase = createClient();
  const { error } = await supabase.from("strategy_actions").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/strategy");
}

export async function deleteStrategyAction(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("strategy_actions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/strategy");
}
