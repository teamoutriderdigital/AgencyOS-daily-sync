"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createBacklogItem, deleteBacklogItem, setBacklogReviewed } from "@/lib/backlog-actions";
import type { BacklogItem } from "@/lib/backlog";
import type { Department } from "@/lib/database.types";
import { DEPARTMENTS, getDepartmentClasses } from "@/lib/department";
import { SectionShell } from "./section-shell";

// The raw intake list — anything worth triaging later, manual or Fathom-sourced
// (Fathom arrives in Phase 3). Defaults to hiding reviewed items so the list
// stays focused on what still needs a look.
export function BacklogSection({ items }: { items: BacklogItem[] }) {
  const [adding, setAdding] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);

  const visible = useMemo(
    () => (showReviewed ? items : items.filter((i) => !i.reviewed)),
    [items, showReviewed]
  );

  return (
    <SectionShell
      title="Backlog"
      count={visible.length}
      countLabel="items"
      rightSlot={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={showReviewed}
              onChange={(e) => setShowReviewed(e.target.checked)}
            />
            Show reviewed
          </label>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong"
          >
            + Add
          </button>
        </div>
      }
    >
      <div className="divide-y divide-border/50">
        {adding && <NewBacklogRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
        {visible.length === 0 && !adding && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            {showReviewed ? "Backlog is empty." : "Nothing waiting on review."}
          </p>
        )}
        {visible.map((item) => (
          <BacklogRow key={item.id} item={item} />
        ))}
      </div>
    </SectionShell>
  );
}

function SourceTag({ item }: { item: BacklogItem }) {
  if (item.source === "fathom") {
    const isUrl = !!item.source_ref && item.source_ref.startsWith("http");
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-text-muted">
        🎙️ Fathom
        {isUrl && (
          <a
            href={item.source_ref!}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </a>
        )}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full border border-border bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-text-muted">
      manual
    </span>
  );
}

function BacklogRow({ item }: { item: BacklogItem }) {
  const [, startTransition] = useTransition();
  const [pending, startDeleteTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <input
        type="checkbox"
        checked={item.reviewed}
        onChange={(e) => startTransition(() => setBacklogReviewed(item.id, e.target.checked))}
        className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer accent-accent"
        title={item.reviewed ? "Reviewed" : "Mark reviewed"}
      />
      <div className={cn("min-w-0 flex-1 space-y-1", item.reviewed && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("min-w-0 break-words text-sm font-semibold text-text", item.reviewed && "line-through")}>
            {item.title}
          </p>
          <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-semibold", getDepartmentClasses(item.department))}>
            {item.department ?? "Unassigned"}
          </span>
          <SourceTag item={item} />
        </div>
        {item.detail && <p className="text-xs text-text-muted">{item.detail}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this backlog item?")) {
            startDeleteTransition(() => deleteBacklogItem(item.id));
          }
        }}
        className={cn("mt-0.5 flex-shrink-0 text-xs text-text-muted hover:text-red-600", pending && "opacity-50")}
        title="Delete"
      >
        🗑️
      </button>
    </div>
  );
}

function NewBacklogRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [department, setDepartment] = useState<Department | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createBacklogItem({ title: t, detail: detail.trim() || null, department });
      onSaved();
    });
  };

  return (
    <div className="space-y-2 bg-surface-alt/30 px-5 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="text"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="What's the item?"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
        <select
          value={department ?? ""}
          onChange={(e) => setDepartment((e.target.value as Department) || null)}
          className="flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted"
          title="Department"
        >
          <option value="">—</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={detail}
        rows={2}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Detail (optional)…"
        className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !title.trim()}
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
