"use client";

import { useMemo, useState, useTransition } from "react";
import type { DailyHeadline, HeadlineTask } from "@/lib/daily";
import type { Client } from "@/lib/clients";
import { clientStageClasses } from "@/lib/clients";
import { updateHeadlineTask } from "@/lib/daily-actions";
import { cn } from "@/lib/utils";
import { SectionShell } from "./section-shell";

// The most recent daily meeting's client headlines on the weekly L10: each
// client (name · stage · lead) with its per-bullet tasks. Every bullet shows its
// responsible owner and a done checkbox that persists to the daily board.
export function WeeklyHeadlinesSection({
  headlines,
  tasks,
  date,
  clients
}: {
  headlines: DailyHeadline[];
  tasks: HeadlineTask[];
  date: string | null;
  clients: Client[];
}) {
  const [doneById, setDoneById] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(tasks.map((t) => [t.id, t.done]))
  );
  const [, startTransition] = useTransition();

  const tasksByHeadline = useMemo(() => {
    const map = new Map<number, HeadlineTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.headline_id) ?? [];
      arr.push(t);
      map.set(t.headline_id, arr);
    }
    return map;
  }, [tasks]);

  const stageByClient = useMemo(() => {
    const m = new Map<string, Client["stage"]>();
    for (const c of clients) m.set(c.name.trim().toLowerCase(), c.stage);
    return m;
  }, [clients]);

  const dateLabel = date
    ? new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    : "";

  const toggle = (id: number, next: boolean) => {
    setDoneById((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      try {
        await updateHeadlineTask(id, { done: next });
      } catch {
        setDoneById((prev) => ({ ...prev, [id]: !next })); // revert on failure
      }
    });
  };

  return (
    <SectionShell title="Client headlines" count={headlines.length} countLabel={date ? `from ${dateLabel}` : "latest daily"}>
      {headlines.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs italic text-text-muted">
          No client headlines from the last daily yet.
        </p>
      ) : (
        <div className="divide-y divide-border/50">
          {headlines.map((h) => {
            const hTasks = tasksByHeadline.get(h.id) ?? [];
            const stage = h.client ? stageByClient.get(h.client.trim().toLowerCase()) : undefined;
            return (
              <div key={h.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {h.client && (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-sm font-semibold text-accent-strong">
                      {h.client}
                    </span>
                  )}
                  {stage && (
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", clientStageClasses(stage))}>
                      {stage}
                    </span>
                  )}
                  {h.owner && <OwnerTag owner={h.owner} lead />}
                  {h.text && <span className="text-sm text-text-muted">{h.text}</span>}
                </div>
                {hTasks.length > 0 && (
                  <ul className="mt-2 space-y-1.5 pl-0.5">
                    {hTasks.map((t) => {
                      const done = doneById[t.id] ?? t.done;
                      return (
                        <li key={t.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(e) => toggle(t.id, e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 cursor-pointer accent-green-600"
                            title={done ? "Mark not done" : "Mark done"}
                          />
                          <span className={done ? "text-text-muted line-through" : "text-text"}>{t.text}</span>
                          {t.owner && <OwnerTag owner={t.owner} />}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

function OwnerTag({ owner, lead = false }: { owner: string; lead?: boolean }) {
  return (
    <span
      className={
        lead
          ? "rounded-full border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted"
          : "rounded-full border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
      }
      title={lead ? "Headline lead" : "Responsible"}
    >
      {lead ? `lead: ${owner}` : owner}
    </span>
  );
}
