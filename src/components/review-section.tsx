"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createReviewItem, deleteReviewItem, updateReviewItem } from "@/lib/daily-actions";
import type { DailyReviewItem } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

// "Items to review for the day" — a per-day checklist that sits between Client
// headlines and To-dos. Each item is one line with a "reviewed" checkbox. The
// list is date-scoped and starts fresh each day (it does not carry over).
export function ReviewSection({
  items,
  date,
  currentMember
}: {
  items: DailyReviewItem[];
  date: string;
  currentMember: TeamMember | null;
}) {
  const openCount = items.filter((i) => !i.done).length;

  return (
    <SectionShell title="Items to review for the day" count={openCount} countLabel="to review">
      <AddReviewForm date={date} currentMember={currentMember} />
      <div className="divide-y divide-border/50">
        {items.length === 0 && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            Nothing to review yet. Add anything the team should go over today.
          </p>
        )}
        {items.map((item) => (
          <ReviewRow key={item.id} item={item} />
        ))}
      </div>
    </SectionShell>
  );
}

// Persistent add bar — stays on screen; saving clears and keeps it ready.
function AddReviewForm({
  date,
  currentMember
}: {
  date: string;
  currentMember: TeamMember | null;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await createReviewItem({ review_date: date, text: t, created_by: currentMember });
      setText("");
    });
  };

  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface-alt/30 px-5 py-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="Something to review today…"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
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
  );
}

function ReviewRow({ item }: { item: DailyReviewItem }) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <input
        type="checkbox"
        checked={item.done}
        onChange={(e) =>
          startTransition(() => updateReviewItem(item.id, { done: e.target.checked }))
        }
        className="h-4 w-4 flex-shrink-0 cursor-pointer accent-accent"
        title={item.done ? "Reviewed" : "Mark reviewed"}
      />
      <input
        type="text"
        defaultValue={item.text}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== item.text) startTransition(() => updateReviewItem(item.id, { text: v }));
        }}
        className={cn(
          "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text hover:border-border focus:border-accent/50 focus:outline-none",
          item.done && "text-text-muted line-through"
        )}
      />
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this item?")) {
            startTransition(() => deleteReviewItem(item.id));
          }
        }}
        className="flex-shrink-0 text-xs text-text-muted hover:text-red-600"
        title="Delete"
      >
        🗑️
      </button>
    </div>
  );
}
