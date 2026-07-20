// Fathom REST API client — single-endpoint design (Task 0 verified the
// contract in .superpowers/sdd/fathom-api-notes.md): GET /meetings with
// include_transcript=true returns everything inline, no separate transcript
// fetch. Base URL + auth header per those notes.

const FATHOM_BASE_URL = "https://api.fathom.ai/external/v1";
const MAX_PAGES = 5;

export function fathomConfigured(): boolean {
  return !!process.env.FATHOM_API_KEY;
}

export type FathomMeeting = {
  recording_id: string | number;
  title: string;
  created_at: string;
  transcript: unknown[];
};

// Raw shape is loosely documented — treat every field defensively.
type RawFathomMeeting = {
  recording_id?: string | number;
  id?: string | number;
  title?: string;
  meeting_title?: string;
  created_at?: string;
  transcript?: unknown[];
};

type RawFathomResponse = {
  items?: RawFathomMeeting[];
  data?: RawFathomMeeting[];
  meetings?: RawFathomMeeting[];
  next_cursor?: string | null;
  cursor?: string | null;
};

function normalizeMeeting(raw: RawFathomMeeting): FathomMeeting {
  return {
    recording_id: raw.recording_id ?? raw.id ?? "",
    title: raw.meeting_title ?? raw.title ?? "",
    created_at: raw.created_at ?? "",
    transcript: Array.isArray(raw.transcript) ? raw.transcript : []
  };
}

export async function listMeetings(fromISO: string, toISO: string): Promise<FathomMeeting[]> {
  const apiKey = process.env.FATHOM_API_KEY;
  if (!apiKey) throw new Error("FATHOM_API_KEY is not configured.");

  const meetings: FathomMeeting[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      created_after: fromISO,
      created_before: toISO,
      include_transcript: "true"
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${FATHOM_BASE_URL}/meetings?${params.toString()}`, {
      headers: { "X-Api-Key": apiKey },
      cache: "no-store"
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Fathom API error: ${res.status} ${res.statusText} — ${body}`);
    }

    const json = (await res.json()) as RawFathomResponse;
    const items = json.items ?? json.data ?? json.meetings ?? [];
    meetings.push(...items.map(normalizeMeeting));

    const next = json.next_cursor ?? json.cursor ?? null;
    if (!next) break;
    cursor = next;
  }

  return meetings;
}

export function transcriptToText(t: unknown[]): string {
  return t
    .map((el) => {
      if (el && typeof el === "object") {
        const obj = el as Record<string, unknown>;
        if (typeof obj.speaker === "string" && typeof obj.text === "string") {
          return `${obj.speaker}: ${obj.text}`;
        }
        if (typeof obj.text === "string") {
          return obj.text;
        }
      }
      return JSON.stringify(el);
    })
    .join("\n");
}
