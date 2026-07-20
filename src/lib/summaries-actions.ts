"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import { isoWeekStart } from "./weekly";
import { fathomConfigured, listMeetings, transcriptToText } from "./fathom";

// Shared: fetch + flatten the selected ISO week's Fathom transcripts.
async function weekTranscripts(
  year: number,
  week: number
): Promise<{ text: string; recordingIds: string[] }> {
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const meetings = await listMeetings(start.toISOString(), end.toISOString());
  const text = meetings.map((m) => transcriptToText(m.transcript)).join("\n\n");
  const recordingIds = meetings.map((m) => String(m.recording_id));
  return { text, recordingIds };
}

export async function generateItemSummaries(
  year: number,
  week: number
): Promise<{ generated: number; skipped: string[] }> {
  if (!fathomConfigured() || !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Summaries need FATHOM_API_KEY and ANTHROPIC_API_KEY configured in the deployment.");
  }
  const supabase = createClient();
  const anthropic = new Anthropic();

  const { text, recordingIds } = await weekTranscripts(year, week);
  if (!text.trim()) return { generated: 0, skipped: ["no Fathom transcripts in week"] };

  const [{ data: rocks }, { data: issues }] = await Promise.all([
    supabase.from("rocks").select("id, title"),
    supabase.from("ids_items").select("id, issue").eq("archived", false)
  ]);

  const items: { item_type: "rock" | "ids"; item_id: number; label: string }[] = [
    ...(rocks ?? []).map((r) => ({ item_type: "rock" as const, item_id: r.id, label: r.title })),
    ...(issues ?? []).map((i) => ({ item_type: "ids" as const, item_id: i.id, label: i.issue }))
  ];

  const skipped: string[] = [];
  let generated = 0;
  for (const it of items) {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            `From this meeting transcript, write a 1-2 sentence recap of what was ` +
            `discussed or decided about the following item. If it was not mentioned, ` +
            `reply exactly "Not discussed."\n\nItem: ${it.label}\n\nTranscript:\n${text}`
        }
      ]
    });
    const block = msg.content.find((b) => b.type === "text");
    const summary = block && block.type === "text" ? block.text.trim() : "";
    if (!summary || summary === "Not discussed.") {
      skipped.push(it.label);
      continue;
    }

    const { error } = await supabase.from("item_summaries").upsert(
      {
        item_type: it.item_type,
        item_id: it.item_id,
        week_number: week,
        year_number: year,
        summary,
        source_ref: recordingIds.join(",")
      },
      { onConflict: "item_type,item_id,week_number,year_number" }
    );
    if (error) throw new Error(error.message);
    generated++;
  }
  revalidatePath("/weekly");
  return { generated, skipped };
}

// ─── Backlog extraction ──────────────────────────────────────────────────────

type ExtractedBacklogItem = { title: string; detail?: string };

const BACKLOG_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" }
        }
      }
    }
  }
} as const;

export async function extractBacklogFromFathom(year: number, week: number): Promise<{ inserted: number }> {
  if (!fathomConfigured() || !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Summaries need FATHOM_API_KEY and ANTHROPIC_API_KEY configured in the deployment.");
  }
  const supabase = createClient();
  const anthropic = new Anthropic();

  const { text, recordingIds } = await weekTranscripts(year, week);
  if (!text.trim()) return { inserted: 0 };

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    output_config: {
      format: { type: "json_schema", schema: BACKLOG_EXTRACTION_SCHEMA }
    },
    messages: [
      {
        role: "user",
        content:
          `Read this meeting transcript and extract any parking-lot items, ` +
          `future-client asks, or backlog ideas that were mentioned but not ` +
          `acted on this week. If there are none, return an empty items array.\n\n` +
          `Transcript:\n${text}`
      }
    ]
  });

  const block = msg.content.find((b) => b.type === "text");
  let extracted: ExtractedBacklogItem[] = [];
  if (block && block.type === "text") {
    try {
      const parsed = JSON.parse(block.text) as { items?: ExtractedBacklogItem[] };
      extracted = Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      extracted = [];
    }
  }

  const { data: existing } = await supabase.from("backlog_items").select("title");
  const seen = new Set((existing ?? []).map((r) => r.title.trim().toLowerCase()));

  let inserted = 0;
  for (const item of extracted) {
    const title = (item.title ?? "").trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const { error } = await supabase.from("backlog_items").insert({
      title,
      detail: item.detail ?? null,
      source: "fathom",
      source_ref: recordingIds.join(","),
      reviewed: false
    });
    if (error) throw new Error(error.message);
    inserted++;
  }

  revalidatePath("/weekly");
  return { inserted };
}
