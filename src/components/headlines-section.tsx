"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createHeadline, deleteHeadline, updateHeadline } from "@/lib/daily-actions";
import type { DailyHeadline } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";
import { ClientChips } from "./client-chips";

// One entry per client for the selected day. Pick a client, then type the
// update — use new lines for bullets. The add form is always visible at the top
// with the client chips (Redstone / SBD / COD / Vital / used-before / + Other).
export function HeadlinesSection({
  headlines,
  date,
  currentMember,
  clients = []
}: {
  headlines: DailyHeadline[];
  date: string;
  currentMember: TeamMember | null;
  clients?: string[];
}) {
  return (
    <SectionShell title="Client headlines" count={headlines.length} countLabel="headlines">
      <AddHeadlineForm date={date} currentMember={currentMember} clients={clients} />
      <div className="divide-y divide-border/50">
        {headlines.length === 0 && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No headlines yet. Pick a client above and add the day&apos;s update.
          </p>
        )}
        {headlines.map((h) => (
          <HeadlineRow key={h.id} headline={h} clients={clients} />
        ))}
      </div>
    </SectionShell>
  );
}

// Persistent add bar — chips always on screen; saving clears and keeps it ready.
// The text is a textarea so you can enter multiple bullet lines.
function AddHeadlineForm({
  date,
  currentMember,
  clients
}: {
  date: string;
  currentMember: TeamMember | null;
  clients: string[];
}) {
  const [client, setClient] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await createHeadline({ headline_date: date, client, text: t, created_by: currentMember });
      setText("");
      setClient(null);
    });
  };

  return (
    <div className="space-y-2 border-b border-border bg-surface-alt/30 px-5 py-3">
      <ClientChips value={client} onChange={setClient} known={clients} />
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
          placeholder={"What's the update? One line each for bullets.\n• …\n• …"}
          className="min-w-0 flex-1 resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !text.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function HeadlineRow({ headline, clients }: { headline: DailyHeadline; clients: string[] }) {
  const [editing, setEditing] = useState(false);
  const [client, setClient] = useState<string | null>(headline.client);
  const [text, setText] = useState(headline.text);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await updateHeadline(headline.id, { client, text: t });
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="space-y-2 bg-surface-alt/30 px-5 py-3">
        <ClientChips value={client} onChange={setClient} known={clients} />
        <div className="flex items-start gap-2">
          <textarea
            value={text}
            rows={5}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Update… (one line each for bullets)"
            className="min-w-0 flex-1 resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={save}
              disabled={pending || !text.trim()}
              className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      {headline.client ? (
        <span className="mt-0.5 w-24 flex-shrink-0 truncate rounded-full border border-border bg-surface-alt px-2 py-0.5 text-center text-xs font-semibold text-text-muted">
          {headline.client}
        </span>
      ) : (
        <span className="mt-0.5 w-24 flex-shrink-0 text-xs italic text-text-muted">—</span>
      )}
      <span className="min-w-0 flex-1 whitespace-pre-line break-words text-sm text-text">
        {headline.text}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-0.5 text-xs text-text-muted hover:text-accent"
        title="Edit"
      >
        ✏️
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this headline?")) {
            startTransition(() => deleteHeadline(headline.id));
          }
        }}
        className={cn("mt-0.5 text-xs text-text-muted hover:text-red-600", pending && "opacity-50")}
        title="Delete"
      >
        🗑️
      </button>
    </div>
  );
}
