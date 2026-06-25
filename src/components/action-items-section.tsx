"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { L10_PRIORITIES, getPriorityClasses, type ActionItem } from "@/lib/l10";
import { OWNERS } from "@/lib/team";
import {
  createActionItem,
  deleteActionItem,
  toggleActionItemDone,
  updateActionItem
} from "@/lib/l10-actions";
import type { L10Priority, TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

type Sort = "due" | "priority" | "created";

export function ActionItemsSection({ items }: { items: ActionItem[] }) {
  const [showDone, setShowDone] = useState(false);
  const [sortBy, setSortBy] = useState<Sort>("due");
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => {
    const filtered = showDone ? items : items.filter((i) => !i.done);
    const priorityRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "due") {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      }
      if (sortBy === "priority") {
        return (priorityRank[a.priority ?? "Low"] ?? 99) - (priorityRank[b.priority ?? "Low"] ?? 99);
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return sorted;
  }, [items, showDone, sortBy]);

  return (
    <SectionShell
      title="To-dos"
      count={visible.length}
      countLabel={showDone ? "items" : "open"}
      rightSlot={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show done
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as Sort)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
          >
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Created</option>
          </select>
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
        {visible.length === 0 && !adding && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No to-dos. Nice and clear.
          </p>
        )}
        {visible.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
        {adding && <NewActionRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
      </div>
    </SectionShell>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-start gap-3 px-5 py-2.5">
      <button
        type="button"
        onClick={() => startTransition(() => toggleActionItemDone(item.id, !item.done))}
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2",
          item.done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 hover:border-accent"
        )}
        aria-label={item.done ? "Mark not done" : "Mark done"}
      >
        {item.done && <span className="text-xs leading-3">✓</span>}
      </button>
      <input
        type="text"
        defaultValue={item.item}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== item.item) startTransition(() => updateActionItem(item.id, { item: v }));
        }}
        className={cn(
          "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-accent/50 focus:outline-none",
          item.done ? "text-text-muted line-through" : "text-text"
        )}
      />
      <select
        value={item.assignee ?? ""}
        onChange={(e) =>
          startTransition(() =>
            updateActionItem(item.id, { assignee: (e.target.value as TeamMember) || null })
          )
        }
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Assignee"
      >
        <option value="">—</option>
        {OWNERS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <input
        type="date"
        defaultValue={item.due_date ?? ""}
        onBlur={(e) => {
          const v = e.target.value || null;
          if (v !== (item.due_date ?? null)) {
            startTransition(() => updateActionItem(item.id, { due_date: v }));
          }
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Due date"
      />
      <select
        value={item.priority ?? ""}
        onChange={(e) =>
          startTransition(() =>
            updateActionItem(item.id, { priority: (e.target.value as L10Priority) || null })
          )
        }
        className={cn(
          "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
          item.priority ? getPriorityClasses(item.priority) : "bg-surface text-text-muted border-border"
        )}
        title="Urgency"
      >
        <option value="">—</option>
        {L10_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this to-do?")) {
            startTransition(() => deleteActionItem(item.id));
          }
        }}
        className="text-xs text-text-muted hover:text-red-600"
      >
        ✕
      </button>
    </div>
  );
}

function NewActionRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [item, setItem] = useState("");
  const [assignee, setAssignee] = useState<TeamMember | "">("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<L10Priority | "">("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = item.trim();
    if (!v) return;
    startTransition(async () => {
      await createActionItem({
        item: v,
        assignee: assignee || null,
        due_date: dueDate || null,
        priority: priority || null
      });
      onSaved();
    });
  };

  return (
    <div className="flex items-start gap-3 bg-surface-alt/30 px-5 py-2.5">
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 border-border" />
      <input
        type="text"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder="What needs doing?"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
      <select
        value={assignee}
        onChange={(e) => setAssignee(e.target.value as TeamMember | "")}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Assignee"
      >
        <option value="">—</option>
        {OWNERS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Due date"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as L10Priority | "")}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Urgency"
      >
        <option value="">—</option>
        {L10_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={pending || !item.trim()}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
      >
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text">
        Cancel
      </button>
    </div>
  );
}
