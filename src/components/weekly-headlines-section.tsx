"use client";

import { useMemo } from "react";
import type { DailyHeadline, HeadlineTask } from "@/lib/daily";
import { SectionShell } from "./section-shell";

// Read-only mirror of the most recent daily meeting's client headlines on the
// weekly L10: each headline (client + update + lead) with its per-bullet tasks,
// every task showing its responsible owner and done state. Editing still happens
// on the daily board — this is the L10 review view.
export function WeeklyHeadlinesSection({
  headlines,
  tasks,
  date
}: {
  headlines: DailyHeadline[];
  tasks: HeadlineTask[];
  date: string | null;
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

  const dateLabel = date
    ? new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    : "";

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
            return (
              <div key={h.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {h.client && (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent-strong">
                      {h.client}
                    </span>
                  )}
                  <span className="text-sm font-medium text-text">{h.text}</span>
                  {h.owner && <OwnerTag owner={h.owner} lead />}
                </div>
                {hTasks.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-1">
                    {hTasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 text-sm">
                        <span className={t.done ? "text-green-600" : "text-text-muted"}>{t.done ? "✓" : "•"}</span>
                        <span className={t.done ? "text-text-muted line-through" : "text-text"}>{t.text}</span>
                        {t.owner && <OwnerTag owner={t.owner} />}
                      </li>
                    ))}
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
