"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { OWNERS } from "@/lib/team";
import { OPS_STATUSES, getOpsStatusClasses, isOpenOpsTask, type OpsTask } from "@/lib/ops";
import { createOpsTask, deleteOpsTask, updateOpsTask } from "@/lib/ops-actions";
import type { OpsStatus, TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

// Ops task list — title + owner + status. Done tasks hide unless "Show done"
// is on; open tasks sort by status (Blocked first) then creation.
export function OpsSection({ tasks }: { tasks: OpsTask[] }) {
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => {
    const filtered = showDone ? tasks : tasks.filter(isOpenOpsTask);
    // Surface Blocked first, then In progress, then Open, then Done.
    const rank: Record<OpsStatus, number> = {
      Blocked: 0,
      "In progress": 1,
      Open: 2,
      Done: 3
    };
    return [...filtered].sort((a, b) => {
      const sr = rank[a.status] - rank[b.status];
      if (sr !== 0) return sr;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [tasks, showDone]);

  return (
    <SectionShell
      title="Ops"
      count={tasks.filter(isOpenOpsTask).length}
      countLabel="open"
      rightSlot={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show done
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
        {visible.length === 0 && !adding && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No ops tasks. All clear.
          </p>
        )}
        {visible.map((task) => (
          <OpsRow key={task.id} task={task} />
        ))}
        {adding && <NewOpsRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
      </div>
    </SectionShell>
  );
}

function OpsRow({ task }: { task: OpsTask }) {
  const [, startTransition] = useTransition();
  const done = task.status === "Done";
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <input
        type="text"
        defaultValue={task.title}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== task.title) startTransition(() => updateOpsTask(task.id, { title: v }));
        }}
        placeholder="Ops task"
        className={cn(
          "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-accent/50 focus:outline-none",
          done ? "text-text-muted line-through" : "text-text"
        )}
      />
      <select
        value={task.owner ?? ""}
        onChange={(e) =>
          startTransition(() =>
            updateOpsTask(task.id, { owner: (e.target.value as TeamMember) || null })
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
        value={task.status}
        onChange={(e) =>
          startTransition(() => updateOpsTask(task.id, { status: e.target.value as OpsStatus }))
        }
        className={cn(
          "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
          getOpsStatusClasses(task.status)
        )}
        title="Status"
      >
        {OPS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this ops task?")) startTransition(() => deleteOpsTask(task.id));
        }}
        className="text-xs text-text-muted hover:text-red-600"
      >
        ✕
      </button>
    </div>
  );
}

function NewOpsRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [status, setStatus] = useState<OpsStatus>("Open");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = title.trim();
    if (!v) return;
    startTransition(async () => {
      await createOpsTask({ title: v, owner: owner || null, status });
      onSaved();
    });
  };

  return (
    <div className="flex items-center gap-3 bg-surface-alt/30 px-5 py-2.5">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder="What needs doing?"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
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
        onChange={(e) => setStatus(e.target.value as OpsStatus)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Status"
      >
        {OPS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
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
  );
}
