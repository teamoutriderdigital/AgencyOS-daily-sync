"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { AttendanceStatus, TeamMember } from "./database.types";

function revalidateDaily() {
  revalidatePath("/daily");
}

// ─── Attendance ──────────────────────────────────────────────────────────────
// Mark a member Present / Remote / Out (or null to clear) for a given day.
// Upsert keyed by (checkin_date, member) so it overwrites rather than
// duplicating. Only `status` is written, so any future `mood` note is untouched.

export async function setAttendance(input: {
  checkin_date: string;
  member: TeamMember;
  status: AttendanceStatus | null;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("daily_checkins").upsert(
    {
      checkin_date: input.checkin_date,
      member: input.member,
      status: input.status
    },
    { onConflict: "checkin_date,member" }
  );
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// ─── Headlines ───────────────────────────────────────────────────────────────

export type HeadlineInput = {
  headline_date: string;
  client?: string | null;
  text: string;
  created_by?: TeamMember | null;
};

export async function createHeadline(input: HeadlineInput) {
  const supabase = createClient();
  const text = input.text.trim();
  if (!text) throw new Error("Headline text is required");
  const { error } = await supabase.from("daily_headlines").insert({
    headline_date: input.headline_date,
    client: input.client?.trim() || null,
    text,
    created_by: input.created_by ?? null
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateHeadline(
  id: number,
  input: Partial<Pick<HeadlineInput, "client" | "text">>
) {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  if ("client" in input) patch.client = input.client?.trim() || null;
  if ("text" in input) patch.text = input.text?.trim() || "";
  const { error } = await supabase.from("daily_headlines").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteHeadline(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("daily_headlines").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}
