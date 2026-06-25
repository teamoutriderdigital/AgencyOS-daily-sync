"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  IDS_STATUSES,
  L10_PRIORITIES,
  getIdsStatusClasses,
  getPriorityClasses,
  type IdsItem
} from "@/lib/l10";
import { OWNERS } from "@/lib/team";
import { createIdsItem, deleteIdsItem, updateIdsItem } from "@/lib/l10-actions";
import type { IdsStatus, L10Priority, TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

export function IdsSection({ items }: { items: IdsItem[] }) {
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    const priorityRank: Record<string, number> = { High: 0, Medium: 1 };
    return [...items].sort((a, b) => {
      const pr = (priorityRank[a.priority ?? ""] ?? 99) - (priorityRank[b.priority ?? ""] ?? 99);
      if (pr !== 0) return pr;
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [items]);

  return (
    <SectionShell
      title="IDS"
      count={sorted.length}
      countLabel="issues"
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
        <div className="grid grid-cols-[auto_minmax(0,1.5fr)_auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 border-b border-border bg-surface-alt/40 px-5 py-2 text-left text-xs uppercase tracking-wide text-text-muted">
          <span></span>
          <span className="font-medium">Issue</span>
          <span className="font-medium">Owner</span>
          <span className="font-medium">Status</span>
          <span className="font-medium">Priority</span>
          <span className="font-medium">Client/Internal</span>
          <span className="font-medium">Due date</span>
          <span></span>
          <span></span>
        </div>
        {sorted.length === 0 && !adding && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No open issues. Nothing to identify, discuss, or solve right now.
          </p>
        )}
        {sorted.map((item) => (
          <IdsRow
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
          />
        ))}
        {adding && <NewIdsRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
      </div>
    </SectionShell>
  );
}

function IdsRow({
  item,
  expanded,
  onToggle
}: {
  item: IdsItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <div>
      <div className="grid grid-cols-[auto_minmax(0,1.5fr)_auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-5 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-text-muted hover:text-text"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <input
          type="text"
          defaultValue={item.issue}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== item.issue) startTransition(() => updateIdsItem(item.id, { issue: v }));
          }}
          className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text hover:border-border focus:border-accent/50 focus:outline-none"
          placeholder="Issue…"
        />
        <select
          value={item.owner ?? ""}
          onChange={(e) =>
            startTransition(() =>
              updateIdsItem(item.id, { owner: (e.target.value as TeamMember) || null })
            )
          }
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
          title="Owner"
        >
          <option value="">—</option>
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={item.status}
          onChange={(e) =>
            startTransition(() => updateIdsItem(item.id, { status: e.target.value as IdsStatus }))
          }
          className={cn(
            "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
            getIdsStatusClasses(item.status)
          )}
          title="Status"
        >
          {IDS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={item.priority ?? ""}
          onChange={(e) =>
            startTransition(() =>
              updateIdsItem(item.id, { priority: (e.target.value as L10Priority) || null })
            )
          }
          className={cn(
            "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
            item.priority ? getPriorityClasses(item.priority) : "bg-surface text-text-muted border-border"
          )}
          title="Priority"
        >
          <option value="">—</option>
          {L10_PRIORITIES.filter((p) => p !== "Low").map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          type="text"
          defaultValue={item.client_internal.join(", ")}
          onBlur={(e) => {
            const v = e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            const eq =
              v.length === item.client_internal.length &&
              v.every((t, i) => t === item.client_internal[i]);
            if (!eq) startTransition(() => updateIdsItem(item.id, { client_internal: v }));
          }}
          placeholder="Client/Internal"
          title="Comma-separated tags (e.g. Plan X, Internal)"
          className="min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        />
        <input
          type="date"
          defaultValue={item.due_date ?? ""}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== (item.due_date ?? null)) {
              startTransition(() => updateIdsItem(item.id, { due_date: v }));
            }
          }}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
          title="Due date"
        />
        <button
          type="button"
          onClick={() => {
            if (confirm("Mark this issue solved? (archives it)")) {
              startTransition(() => updateIdsItem(item.id, { archived: true, status: "Solved" }));
            }
          }}
          className="text-xs font-medium text-text-muted hover:text-green-600"
          title="Solved — archive this issue"
        >
          ✓ Solved
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this issue permanently?")) {
              startTransition(() => deleteIdsItem(item.id));
            }
          }}
          className="text-xs text-text-muted hover:text-red-600"
          title="Delete"
        >
          ✕
        </button>
      </div>
      {expanded && (
        <div className="grid gap-3 border-t border-border/30 bg-surface-alt/20 px-5 py-3 lg:grid-cols-3">
          <IdsLongField item={item} field="identify" label="Identify" />
          <IdsLongField item={item} field="discuss" label="Discuss" />
          <IdsLongField item={item} field="solve" label="Solve" />
        </div>
      )}
    </div>
  );
}

function IdsLongField({
  item,
  field,
  label
}: {
  item: IdsItem;
  field: "identify" | "discuss" | "solve";
  label: string;
}) {
  const [, startTransition] = useTransition();
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-text-muted">{label}</p>
      <textarea
        defaultValue={item[field] ?? ""}
        rows={3}
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== (item[field] ?? null)) {
            startTransition(() => updateIdsItem(item.id, { [field]: v }));
          }
        }}
        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-text focus:border-accent/50 focus:outline-none"
        placeholder={`Notes for ${label.toLowerCase()}…`}
      />
    </div>
  );
}

function NewIdsRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [issue, setIssue] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [status, setStatus] = useState<IdsStatus>("Not started");
  const [priority, setPriority] = useState<L10Priority | "">("");
  const [clientInternal, setClientInternal] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = issue.trim();
    if (!v) return;
    const tags = clientInternal
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      await createIdsItem({
        issue: v,
        owner: owner || null,
        status,
        priority: priority || null,
        client_internal: tags,
        due_date: dueDate || null
      });
      onSaved();
    });
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1.5fr)_auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 bg-surface-alt/30 px-5 py-2.5">
      <span className="text-xs text-text-muted">▸</span>
      <input
        type="text"
        value={issue}
        autoFocus
        onChange={(e) => setIssue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="What's the issue?"
        className="min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
      <select
        value={owner}
        onChange={(e) => setOwner(e.target.value as TeamMember | "")}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Owner"
      >
        <option value="">— owner —</option>
        {OWNERS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as IdsStatus)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Status"
      >
        {IDS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as L10Priority | "")}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Priority"
      >
        <option value="">— priority —</option>
        {L10_PRIORITIES.filter((p) => p !== "Low").map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={clientInternal}
        onChange={(e) => setClientInternal(e.target.value)}
        placeholder="Client/Internal"
        title="Comma-separated tags"
        className="min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Due date"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || !issue.trim()}
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
