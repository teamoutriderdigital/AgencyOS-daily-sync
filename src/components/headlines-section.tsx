"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  addHeadlineTask,
  createHeadline,
  deleteHeadline,
  deleteHeadlineTask,
  setHeadlineOwner,
  updateHeadline,
  updateHeadlineTask
} from "@/lib/daily-actions";
import type { DailyHeadline, HeadlineTask } from "@/lib/daily";
import type { TeamMember, ClientStage } from "@/lib/database.types";
import { clientStageClasses } from "@/lib/clients";
import { OWNERS } from "@/lib/team";
import { SectionShell } from "./section-shell";
import { ClientChips } from "./client-chips";

// One entry per client for the selected day. Pick a client, then type the
// update — new lines starting with "•"/"-" become individual tasks, each of
// which can be given an owner. The headline itself also has a client-level
// owner (the lead). The add form is always visible at the top.
export function HeadlinesSection({
  headlines,
  tasks,
  date,
  currentMember,
  clients = [],
  clientStages = {}
}: {
  headlines: DailyHeadline[];
  tasks: HeadlineTask[];
  date: string;
  currentMember: TeamMember | null;
  clients?: string[];
  // Optional client → stage map. When provided (weekly board), each headline
  // shows its client's stage badge. The daily board omits it.
  clientStages?: Record<string, ClientStage>;
}) {
  const tasksByHeadline = useMemo(() => {
    const map = new Map<number, HeadlineTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.headline_id) ?? [];
      arr.push(t);
      map.set(t.headline_id, arr);
    }
    return map;
  }, [tasks]);

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
          <HeadlineRow
            key={h.id}
            headline={h}
            tasks={tasksByHeadline.get(h.id) ?? []}
            clients={clients}
            stage={h.client ? clientStages[h.client] : undefined}
          />
        ))}
      </div>
    </SectionShell>
  );
}

// Small owner picker shared by the headline lead and each task.
function OwnerSelect({
  value,
  onChange,
  label = "owner"
}: {
  value: TeamMember | null;
  onChange: (v: TeamMember | null) => void;
  label?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value as TeamMember) || null)}
      className="flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted"
      title="Owner"
    >
      <option value="">— {label} —</option>
      {OWNERS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// Persistent add bar — chips always on screen; saving clears and keeps it ready.
// The text is a textarea so you can enter multiple bullet lines (each becomes a
// task you can assign an owner to).
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
          placeholder={"What's the update? One line each for bullets — each becomes a task.\n• …\n• …"}
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

// Render the non-bullet lines of a headline as its summary. Bullet lines are
// rendered separately as tasks (see TaskList), so they're skipped here.
function HeadlineSummary({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !(l.startsWith("•") || l.startsWith("-")));

  if (lines.length === 0) return null;

  return (
    <div className="min-w-0 flex-1 space-y-1">
      {lines.map((line, i) => {
        if (/^owner\s*:/i.test(line)) {
          return (
            <p key={i} className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {line}
            </p>
          );
        }
        return (
          <p key={i} className="min-w-0 break-words text-sm leading-snug text-text">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function TaskRow({ task }: { task: HeadlineTask }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) =>
          startTransition(() => updateHeadlineTask(task.id, { done: e.target.checked }))
        }
        className="h-4 w-4 flex-shrink-0 cursor-pointer accent-accent"
        title={task.done ? "Completed" : "Mark completed"}
      />
      <input
        type="text"
        defaultValue={task.text}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== task.text) startTransition(() => updateHeadlineTask(task.id, { text: v }));
        }}
        className={cn(
          "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text hover:border-border focus:border-accent/50 focus:outline-none",
          task.done && "text-text-muted line-through"
        )}
      />
      <OwnerSelect
        value={task.owner}
        onChange={(v) => startTransition(() => updateHeadlineTask(task.id, { owner: v }))}
      />
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this task?")) startTransition(() => deleteHeadlineTask(task.id));
        }}
        className="flex-shrink-0 text-xs text-text-muted hover:text-red-600"
        title="Delete task"
      >
        ✕
      </button>
    </div>
  );
}

function AddTaskInline({ headline }: { headline: DailyHeadline }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = text.trim();
    if (!v) return;
    startTransition(async () => {
      await addHeadlineTask({
        headline_id: headline.id,
        headline_date: headline.headline_date,
        text: v
      });
      setText("");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 flex-shrink-0 text-center text-text-muted">＋</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="Add a task…"
        disabled={pending}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text-muted hover:border-border focus:border-accent/50 focus:text-text focus:outline-none"
      />
    </div>
  );
}

function HeadlineRow({
  headline,
  tasks,
  clients,
  stage
}: {
  headline: DailyHeadline;
  tasks: HeadlineTask[];
  clients: string[];
  stage?: ClientStage;
}) {
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
        <p className="text-xs italic text-text-muted">
          Editing the summary here won&apos;t change existing tasks — manage those below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-5 py-3">
      <div className="flex items-start gap-3">
        {headline.client ? (
          <span className="mt-0.5 w-24 flex-shrink-0 truncate rounded-full border border-border bg-surface-alt px-2 py-0.5 text-center text-xs font-semibold text-text-muted">
            {headline.client}
          </span>
        ) : (
          <span className="mt-0.5 w-24 flex-shrink-0 text-xs italic text-text-muted">—</span>
        )}
        {stage && (
          <span className={cn("mt-0.5 flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", clientStageClasses(stage))}>
            {stage}
          </span>
        )}
        <HeadlineSummary text={headline.text} />
        <OwnerSelect
          value={headline.owner}
          label="lead"
          onChange={(v) => startTransition(() => setHeadlineOwner(headline.id, v))}
        />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-0.5 flex-shrink-0 text-xs text-text-muted hover:text-accent"
          title="Edit"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this headline and its tasks?")) {
              startTransition(() => deleteHeadline(headline.id));
            }
          }}
          className={cn("mt-0.5 flex-shrink-0 text-xs text-text-muted hover:text-red-600", pending && "opacity-50")}
          title="Delete"
        >
          🗑️
        </button>
      </div>

      <div className="space-y-1 pl-[7.5rem]">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        <AddTaskInline headline={headline} />
      </div>
    </div>
  );
}
