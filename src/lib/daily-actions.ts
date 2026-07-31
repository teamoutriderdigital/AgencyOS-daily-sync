"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { AttendanceStatus, TeamMember } from "./database.types";

function revalidateDaily() {
  revalidatePath("/daily");
  // Client headlines are also mirrored (and editable) on the weekly L10 board,
  // so refresh it too when a daily edit lands.
  revalidatePath("/weekly");
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

// Bullet lines ("• …" / "- …") become individual headline_tasks so each can
// carry its own owner. Non-bullet lines stay as the headline's summary text.
function bulletLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("•") || l.startsWith("-"))
    .map((l) => l.replace(/^[•-]\s*/, "").trim())
    .filter(Boolean);
}

export async function createHeadline(input: HeadlineInput) {
  const supabase = createClient();
  const text = input.text.trim();
  if (!text) throw new Error("Headline text is required");
  const { data, error } = await supabase
    .from("daily_headlines")
    .insert({
      headline_date: input.headline_date,
      client: input.client?.trim() || null,
      text,
      created_by: input.created_by ?? null
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Split the bullet lines into per-task rows (owners set later on each row).
  const bullets = bulletLines(text);
  if (bullets.length) {
    const rows = bullets.map((t, i) => ({
      headline_id: data.id,
      headline_date: input.headline_date,
      text: t,
      sort_order: i
    }));
    const { error: taskErr } = await supabase.from("headline_tasks").insert(rows);
    if (taskErr) throw new Error(taskErr.message);
  }
  revalidateDaily();
}

// ─── Headline owner (client-level) ───────────────────────────────────────────

export async function setHeadlineOwner(id: number, owner: TeamMember | null) {
  const supabase = createClient();
  const { error } = await supabase.from("daily_headlines").update({ owner }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// ─── Headline tasks (per-bullet, each with its own owner) ────────────────────

export async function addHeadlineTask(input: {
  headline_id: number;
  headline_date: string;
  text: string;
  owner?: TeamMember | null;
}) {
  const supabase = createClient();
  const text = input.text.trim();
  if (!text) throw new Error("Task text is required");
  const { error } = await supabase.from("headline_tasks").insert({
    headline_id: input.headline_id,
    headline_date: input.headline_date,
    text,
    owner: input.owner ?? null
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateHeadlineTask(
  id: number,
  input: Partial<{ text: string; owner: TeamMember | null; done: boolean }>
) {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  if ("text" in input) patch.text = input.text?.trim() || "";
  if ("owner" in input) patch.owner = input.owner ?? null;
  if ("done" in input) patch.done = input.done;
  const { error } = await supabase.from("headline_tasks").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteHeadlineTask(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("headline_tasks").delete().eq("id", id);
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

// ─── Items to review for the day ─────────────────────────────────────────────
// Date-scoped checklist. Each item is one line of text with a "reviewed"
// checkbox (done). Does not carry over — the list is fresh each day.

export type ReviewItemInput = {
  review_date: string;
  text: string;
  created_by?: TeamMember | null;
};

export async function createReviewItem(input: ReviewItemInput) {
  const supabase = createClient();
  const text = input.text.trim();
  if (!text) throw new Error("Review item text is required");
  const { error } = await supabase.from("daily_review_items").insert({
    review_date: input.review_date,
    text,
    created_by: input.created_by ?? null
  });
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function updateReviewItem(
  id: number,
  input: Partial<{ text: string; done: boolean }>
) {
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  if ("text" in input) patch.text = input.text?.trim() || "";
  if ("done" in input) patch.done = input.done;
  const { error } = await supabase.from("daily_review_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

export async function deleteReviewItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("daily_review_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// ─── Meeting rating (1–10) ───────────────────────────────────────────────────
// One rating per (day, member). Passing a number upserts on the unique key;
// passing null clears (deletes) that member's rating for the day.

export async function setMeetingRating(input: {
  rating_date: string;
  member: TeamMember;
  rating: number | null;
}) {
  const supabase = createClient();
  if (input.rating == null) {
    const { error } = await supabase
      .from("meeting_ratings")
      .delete()
      .eq("rating_date", input.rating_date)
      .eq("member", input.member);
    if (error) throw new Error(error.message);
    revalidateDaily();
    return;
  }
  const rating = Math.round(input.rating);
  if (rating < 1 || rating > 10) throw new Error("Rating must be between 1 and 10");
  const { error } = await supabase.from("meeting_ratings").upsert(
    { rating_date: input.rating_date, member: input.member, rating },
    { onConflict: "rating_date,member" }
  );
  if (error) throw new Error(error.message);
  revalidateDaily();
}

// ─── Pull forward ────────────────────────────────────────────────────────────
// Copy the most recent prior day's client headlines and their UNFINISHED tasks
// onto `date`, so a fresh board starts where the last one left off instead of
// being retyped. A no-op when the target day already has headlines, so the
// button is safe to press twice. Returns what it copied, for the toast.
export async function pullForwardHeadlines(date: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("pull_forward_daily_headlines", {
    target_date: date
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  revalidateDaily();
  return {
    headlines: row?.headlines_copied ?? 0,
    tasks: row?.tasks_copied ?? 0
  };
}
