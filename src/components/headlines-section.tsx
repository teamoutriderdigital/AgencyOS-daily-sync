"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createHeadline, deleteHeadline, updateHeadline } from "@/lib/daily-actions";
import type { DailyHeadline } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";
import { ClientChips } from "./client-chips";

// One line per client headline for the selected day. News, not discussion —
// add / edit / delete inline, scoped to the date. The client is chosen from
// always-visible chips (Redstone / SBD / COD / Vital / + Other).
export function HeadlinesSection({
  headlines,
  date,
  currentMember
}: {
  headlines: DailyHeadline[];
  date: string;
  currentMember: TeamMember | null;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <SectionShell
      title="Client headlines"
      count={headlines.length}
      countLabel="headlines"
      rightSlot={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong"
        >
          + Add
        </button>
      }
    >
      <div className="divide-y divide-border/50">
        {headlines.length === 0 && !adding && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No headlines yet. Good news, bad news — drop the day&apos;s client news here.
          </p>
        )}
        {headlines.map((h) => (
          <HeadlineRow key={h.id} headline={h} />
        ))}
        {adding && (
          <NewHeadlineRow
            date={date}
            currentMember={currentMember}
            onCancel={() => setAdding(false)}
            onSaved={() => setAdding(false)}
          />
        )}
      </div>
    </SectionShell>
  );
}

function HeadlineRow({ headline }: { headline: DailyHeadline }) {
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
        <ClientChips value={client} onChange={setClient} />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Headline…"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
          />
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
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      {headline.client ? (
        <span className="w-40 flex-shrink-0 truncate rounded-full border border-border bg-surface-alt px-2 py-0.5 text-xs font-semibold text-text-muted">
          {headline.client}
        </span>
      ) : (
        <span className="w-40 flex-shrink-0 text-xs italic text-text-muted">—</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-text">{headline.text}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-text-muted hover:text-accent"
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
        className={cn("text-xs text-text-muted hover:text-red-600", pending && "opacity-50")}
        title="Delete"
      >
        🗑️
      </button>
    </div>
  );
}

function NewHeadlineRow({
  date,
  currentMember,
  onCancel,
  onSaved
}: {
  date: string;
  currentMember: TeamMember | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [client, setClient] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await createHeadline({
        headline_date: date,
        client,
        text: t,
        created_by: currentMember
      });
      onSaved();
    });
  };

  return (
    <div className="space-y-2 bg-surface-alt/30 px-5 py-3">
      <ClientChips value={client} onChange={setClient} />
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="What's the headline?"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !text.trim()}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text">
          Cancel
        </button>
      </div>
    </div>
  );
}
