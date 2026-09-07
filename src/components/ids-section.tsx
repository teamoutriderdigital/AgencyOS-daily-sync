"use client";

import { useMemo, useState, useTransition } from "react";
import { retainIssueInPlane } from "@/lib/plane-retention-actions";
import { boardTitle } from "@/lib/board-language";
import { boardToday, deadlineLabel } from "@/lib/subprojects";
import { cn } from "@/lib/utils";
import {
  IDS_STATUSES,
  L10_PRIORITIES,
  getIdsStatusClasses,
  getPriorityClasses,
  type IdsItem
} from "@/lib/l10";
import { OWNERS } from "@/lib/team";
import { DEPARTMENTS, getDepartmentClasses, groupByDepartment } from "@/lib/department";
import { createIdsItem, deleteIdsItem, updateIdsItem, upvoteIdsItem } from "@/lib/l10-actions";
import type { Department, IdsStatus, L10Priority, TeamMember } from "@/lib/database.types";
import type { Rock } from "@/lib/rocks";
import { summaryKey } from "@/lib/summaries";
import type { ItemSummary } from "@/lib/summaries";
import { SectionShell } from "./section-shell";
import { CarryoverBadge } from "./carryover-badge";

// Grow a textarea to fit its content so the full issue text is always visible.
function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function IdsSection({
  items,
  rocks,
  summaries
}: {
  items: IdsItem[];
  rocks: Rock[];
  summaries: Map<string, ItemSummary>;
}) {
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [groupByDept, setGroupByDept] = useState(false);

  const sorted = useMemo(() => {
    const priorityRank: Record<string, number> = { High: 0, Medium: 1 };
    return [...items].sort((a, b) => {
      // Newest first — the issue created today sits at the top, then older ones.
      // Ties (same timestamp) fall back to most-upvoted, then priority, then due.
      const ac = new Date(a.created_at).getTime();
      const bc = new Date(b.created_at).getTime();
      if (bc !== ac) return bc - ac;
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      const pr = (priorityRank[a.priority ?? ""] ?? 99) - (priorityRank[b.priority ?? ""] ?? 99);
      if (pr !== 0) return pr;
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [items]);

  const grouped = useMemo(() => groupByDepartment(sorted, (i) => i.department), [sorted]);

  return (
    <SectionShell
      title="IDS"
      count={sorted.length}
      countLabel="issues"
      rightSlot={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={groupByDept}
              onChange={(e) => setGroupByDept(e.target.checked)}
            />
            Group by department
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
      <div className="overflow-x-auto">
      <div className="min-w-[1140px] divide-y divide-border/50">
        <div className="grid grid-cols-[auto_auto_minmax(0,2.5fr)_auto_auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 border-b border-border bg-surface-alt/40 px-5 py-2 text-left text-xs uppercase tracking-wide text-text-muted">
          <span></span>
          <span className="font-medium">Votes</span>
          <span className="font-medium">Issue</span>
          <span className="font-medium">Owner</span>
          <span className="font-medium">Status</span>
          <span className="font-medium">Priority</span>
          <span className="font-medium">Department</span>
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
        {groupByDept
          ? grouped.map((g) => (
              <div key={g.department}>
                <div
                  className={cn(
                    "border-b border-border/50 px-5 py-1.5 text-xs font-semibold",
                    getDepartmentClasses(g.department === "Unassigned" ? null : g.department)
                  )}
                >
                  {g.department}
                </div>
                {g.items.map((item) => (
                  <IdsRow
                    key={item.id}
                    item={item}
                    rocks={rocks}
                    summaries={summaries}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
                  />
                ))}
              </div>
            ))
          : sorted.map((item) => (
              <IdsRow
                key={item.id}
                item={item}
                rocks={rocks}
                summaries={summaries}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
              />
            ))}
        {adding && (
          <NewIdsRow rocks={rocks} onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />
        )}
      </div>
      </div>
    </SectionShell>
  );
}

function IdsRow({
  item,
  rocks,
  summaries,
  expanded,
  onToggle
}: {
  item: IdsItem;
  rocks: Rock[];
  summaries: Map<string, ItemSummary>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [, startTransition] = useTransition();
  const linkedRock = item.rock_id != null ? rocks.find((r) => r.id === item.rock_id) : undefined;
  return (
    <div>
      <div className="grid grid-cols-[auto_auto_minmax(0,2.5fr)_auto_auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-5 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-text-muted hover:text-text"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <button
          type="button"
          onClick={() => startTransition(() => upvoteIdsItem(item.id))}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text-muted hover:border-accent/50 hover:text-accent"
          title="Upvote this topic"
        >
          👍 {item.upvotes}
        </button>
        <div className="flex min-w-0 flex-col gap-1">
          <textarea
            ref={autoResize}
            defaultValue={boardTitle(item.issue)}
            rows={1}
            onInput={(e) => autoResize(e.currentTarget)}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== boardTitle(item.issue)) startTransition(() => updateIdsItem(item.id, { issue: v }));
            }}
            className="min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-snug text-text hover:border-border focus:border-accent/50 focus:outline-none"
            placeholder="Issue…"
          />
          {item.carried_from_week != null && (
            <span className="px-2">
              <CarryoverBadge fromWeek={item.carried_from_week} />
            </span>
          )}
          {linkedRock && (
            <span className="mx-2 w-fit rounded-full border border-border bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-text-muted">
              🪨 {linkedRock.title}
            </span>
          )}
          <select
            value={item.rock_id ?? ""}
            onChange={(e) =>
              startTransition(() =>
                updateIdsItem(item.id, { rock_id: e.target.value ? Number(e.target.value) : null })
              )
            }
            className="mx-2 w-fit rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-text-muted"
            title="Linked rock"
          >
            <option value="">— rock —</option>
            {rocks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
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
        <select
          value={item.department ?? ""}
          onChange={(e) =>
            startTransition(() =>
              updateIdsItem(item.id, { department: (e.target.value as Department) || null })
            )
          }
          className={cn(
            "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
            getDepartmentClasses(item.department)
          )}
          title="Department"
        >
          <option value="">—</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
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
        <div className="space-y-1">
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
          <p className="text-xs text-text-muted">{deadlineLabel(item.due_date, boardToday())}</p>
        </div>
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
        <div className="border-t border-border/30 bg-surface-alt/20 px-5 py-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <IdsLongField item={item} field="identify" label="Identify" />
            <IdsLongField item={item} field="discuss" label="Discuss" />
            <IdsLongField item={item} field="solve" label="Solve" />
          </div>
          <PlaneRetention issueId={item.id} />
          {summaries.get(summaryKey("ids", item.id)) && (
            <p className="mt-3 rounded bg-surface-alt/60 px-2 py-1 text-[11px] italic text-text-muted">
              <span className="font-semibold not-italic">Last meeting: </span>
              {summaries.get(summaryKey("ids", item.id))!.summary}
            </p>
          )}
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

function NewIdsRow({
  rocks,
  onCancel,
  onSaved
}: {
  rocks: Rock[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [issue, setIssue] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [status, setStatus] = useState<IdsStatus>("Not started");
  const [priority, setPriority] = useState<L10Priority | "">("");
  const [department, setDepartment] = useState<Department | "">("");
  const [rockId, setRockId] = useState<number | "">("");
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
        due_date: dueDate || null,
        department: department || null,
        rock_id: rockId === "" ? null : rockId
      });
      onSaved();
    });
  };

  return (
    <div className="grid grid-cols-[auto_auto_minmax(0,2.5fr)_auto_auto_auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 bg-surface-alt/30 px-5 py-2.5">
      <span className="text-xs text-text-muted">▸</span>
      <span className="text-xs text-text-muted">—</span>
      <div className="flex min-w-0 flex-col gap-1">
        <textarea
          ref={autoResize}
          value={issue}
          autoFocus
          rows={1}
          onInput={(e) => autoResize(e.currentTarget)}
          onChange={(e) => setIssue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="What's the issue?"
          className="min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-md border border-border bg-surface px-2 py-1 text-sm leading-snug text-text"
        />
        <select
          value={rockId}
          onChange={(e) => setRockId(e.target.value ? Number(e.target.value) : "")}
          className="mx-2 w-fit rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] text-text-muted"
          title="Linked rock"
        >
          <option value="">— rock —</option>
          {rocks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>
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
      <select
        value={department}
        onChange={(e) => setDepartment(e.target.value as Department | "")}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Department"
      >
        <option value="">— dept —</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
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

function PlaneRetention({ issueId }: { issueId: number }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="mt-4 space-y-2 border-t border-border pt-3" onSubmit={event => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try { await retainIssueInPlane(issueId, url); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the board."); }
    });
  }}>
    <p className="text-xs text-text-muted">For old or closed work: link the matching Plane item before removing this topic from the meeting. Current blockers stay on the agenda.</p>
    <div className="flex flex-wrap gap-2">
      <input type="url" required aria-label="Existing Plane work item URL" placeholder="Link to the matching Plane backlog or closed item" value={url} onChange={event => setUrl(event.target.value)} className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-xs" />
      <button disabled={pending || !url.trim()} className="rounded border border-border px-3 py-1 text-xs disabled:opacity-50">{pending ? "Checking Plane…" : "Keep in Plane, remove from L10"}</button>
    </div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </form>;
}
