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

// ─── Carry forward yesterday's client headlines ──────────────────────────────
// Client headlines are date-scoped, so a new day starts empty. This copies the
// most recent prior day's headlines (the ones the weekly L10 edits in place)
// onto `date`, carrying only each headline's still-open tasks — completed tasks
// stay behind. A headline whose tasks were all done is skipped; a summary-only
// headline (no tasks) still carries. Re-running is safe: a client+text already
// present on `date` is not duplicated.

export async function carryForwardHeadlines(date: string): Promise<{
  carried: number;
  fromDate: string | null;
}> {
  const supabase = createClient();

  // Most recent day that has headlines, strictly before `date`.
  const { data: prior, error: priorErr } = await supabase
    .from("daily_headlines")
    .select("headline_date")
    .lt("headline_date", date)
    .order("headline_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorErr) throw new Error(priorErr.message);
  const fromDate = prior?.headline_date ?? null;
  if (!fromDate) return { carried: 0, fromDate: null };

  const [srcHeadlinesResp, srcTasksResp, todayHeadlinesResp] = await Promise.all([
    supabase
      .from("daily_headlines")
      .select("*")
      .eq("headline_date", fromDate)
      .order("created_at", { ascending: true }),
    supabase
      .from("headline_tasks")
      .select("*")
      .eq("headline_date", fromDate)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("daily_headlines").select("client, text").eq("headline_date", date)
  ]);
  if (srcHeadlinesResp.error) throw new Error(srcHeadlinesResp.error.message);
  if (srcTasksResp.error) throw new Error(srcTasksResp.error.message);
  if (todayHeadlinesResp.error) throw new Error(todayHeadlinesResp.error.message);

  const srcHeadlines = srcHeadlinesResp.data ?? [];
  const srcTasks = srcTasksResp.data ?? [];

  // Dedupe key so re-clicking doesn't pile up the same headlines.
  const existing = new Set(
    (todayHeadlinesResp.data ?? []).map((h) => `${h.client ?? ""}|${h.text}`)
  );

  const tasksByHeadline = new Map<number, typeof srcTasks>();
  for (const t of srcTasks) {
    const arr = tasksByHeadline.get(t.headline_id) ?? [];
    arr.push(t);
    tasksByHeadline.set(t.headline_id, arr);
  }

  let carried = 0;
  for (const h of srcHeadlines) {
    if (existing.has(`${h.client ?? ""}|${h.text}`)) continue;

    const tasks = tasksByHeadline.get(h.id) ?? [];
    const openTasks = tasks.filter((t) => !t.done);
    // Had tasks, but all are done — nothing open left to carry.
    if (tasks.length > 0 && openTasks.length === 0) continue;

    const { data: inserted, error: insErr } = await supabase
      .from("daily_headlines")
      .insert({
        headline_date: date,
        client: h.client,
        text: h.text,
        owner: h.owner,
        created_by: h.created_by
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    if (openTasks.length) {
      const rows = openTasks.map((t, i) => ({
        headline_id: inserted.id,
        headline_date: date,
        text: t.text,
        owner: t.owner,
        sort_order: i
        // `done` defaults to false — carried tasks start open.
      }));
      const { error: taskErr } = await supabase.from("headline_tasks").insert(rows);
      if (taskErr) throw new Error(taskErr.message);
    }
    carried++;
  }

  revalidateDaily();
  return { carried, fromDate };
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
