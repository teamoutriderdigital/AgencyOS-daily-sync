"use client";

import { useMemo } from "react";
import type { ActionItem } from "@/lib/l10";
import { L10_PRIORITIES, getPriorityClasses } from "@/lib/l10";
import type { Rock } from "@/lib/rocks";
import type { Department } from "@/lib/database.types";
import { getDepartmentClasses, groupByDepartment } from "@/lib/department";
import { SectionShell } from "./section-shell";

// The forward-looking close of the Friday meeting: what we're committing to for
// next week. Read-only, derived entirely from already-loaded state — no new
// tables. Two inputs:
//   • Open (undone) to-dos that will carry into next week, prioritised.
//   • Rocks still in flight, "Off track" surfaced first (those ARE the
//     priorities to protect).
// Editing still happens in the To-dos / Rocks sections; this is the summary the
// team reads out before rating the meeting.

// High → Medium → Low → (none), so the most urgent commitments sort to the top.
const PRIORITY_RANK: Record<string, number> = {
  High: 0,
  Medium: 1,
  Low: 2
};

function priorityRank(p: ActionItem["priority"]): number {
  return p && p in PRIORITY_RANK ? PRIORITY_RANK[p] : 3;
}

export function NextWeekSection({
  actionItems,
  rocks,
  todayISO
}: {
  actionItems: ActionItem[];
  rocks: Rock[];
  todayISO: string;
}) {
  // Open to-dos, sorted by priority then soonest due date. These are the
  // commitments that roll forward if not closed by the meeting.
  const openTodos = useMemo(() => {
    return actionItems
      .filter((a) => !a.done)
      .sort((a, b) => {
        const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
        if (byPriority !== 0) return byPriority;
        // Nulls last, then earliest due date first.
        if (!a.due_date) return b.due_date ? 1 : 0;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
  }, [actionItems]);

  const todoGroups = useMemo(
    () => groupByDepartment(openTodos, (t) => t.department),
    [openTodos]
  );

  // Rocks not yet Done, off-track first so at-risk quarterly goals lead.
  const liveRocks = useMemo(
    () =>
      rocks
        .filter((r) => r.status !== "Done")
        .sort((a, b) => (a.status === "Off track" ? 0 : 1) - (b.status === "Off track" ? 0 : 1)),
    [rocks]
  );

  const total = openTodos.length;

  return (
    <SectionShell title="Priorities for next week" count={total} countLabel="open to-dos">
      {total === 0 && liveRocks.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs italic text-text-muted">
          Nothing open — every to-do is done and every rock is closed. Rare, enjoy it.
        </p>
      ) : (
        <div className="space-y-5 px-5 py-4">
          {todoGroups.map((g) => (
            <div key={g.department}>
              <span
                className={`mb-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${getDepartmentClasses(
                  g.department === "Unassigned" ? null : (g.department as Department)
                )}`}
              >
                {g.department}
              </span>
              <ul className="space-y-1">
                {g.items.map((t) => {
                  const overdue = !!t.due_date && t.due_date < todayISO;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm text-text">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getPriorityClasses(
                          t.priority
                        )}`}
                      >
                        {t.priority ?? "—"}
                      </span>
                      <span className="flex-1">{t.item}</span>
                      {t.assignee && (
                        <span className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-muted">
                          {t.assignee}
                        </span>
                      )}
                      {t.due_date && (
                        <span
                          className={`text-[10px] ${overdue ? "font-semibold text-red-600" : "text-text-muted"}`}
                        >
                          {overdue ? "overdue " : "due "}
                          {t.due_date}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {liveRocks.length > 0 && (
            <div>
              <span className="mb-2 inline-block rounded-full border border-border bg-surface-alt px-2 py-0.5 text-xs font-semibold text-text-muted">
                Rocks in flight
              </span>
              <ul className="space-y-1">
                {liveRocks.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm text-text">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        r.status === "Off track"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-border bg-surface-alt text-text-muted"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="flex-1">{r.title || "(untitled rock)"}</span>
                    {r.owner && (
                      <span className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-muted">
                        {r.owner}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}
