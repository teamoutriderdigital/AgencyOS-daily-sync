"use client";

import { useMemo } from "react";
import type { ActionItem, IdsItem } from "@/lib/l10";
import type { Rock } from "@/lib/rocks";
import type { Department } from "@/lib/database.types";
import { getDepartmentClasses, groupByDepartment } from "@/lib/department";
import { SectionShell } from "./section-shell";

type CompletedEntry = { key: string; label: string; kind: "Rock" | "Issue" | "To-do"; department: Department | null };

// Items whose completed_at falls within [weekStartISO, weekEndISO). A read-only
// momentum column — the "done" side of the meeting. weekStartISO/weekEndISO are
// yyyy-mm-dd bounds for the selected ISO week (end exclusive).
export function CompletedSection({
  rocks,
  idsItems,
  actionItems,
  weekStartISO,
  weekEndISO
}: {
  rocks: Rock[];
  idsItems: IdsItem[];
  actionItems: ActionItem[];
  weekStartISO: string;
  weekEndISO: string;
}) {
  const entries = useMemo<CompletedEntry[]>(() => {
    const within = (ts: string | null) => !!ts && ts.slice(0, 10) >= weekStartISO && ts.slice(0, 10) < weekEndISO;
    const out: CompletedEntry[] = [];
    for (const r of rocks) if (r.status === "Done" && within(r.completed_at))
      out.push({ key: `rock-${r.id}`, label: r.title || "(untitled rock)", kind: "Rock", department: r.department });
    for (const i of idsItems) if (within(i.completed_at))
      out.push({ key: `ids-${i.id}`, label: i.issue, kind: "Issue", department: i.department });
    for (const a of actionItems) if (a.done && within(a.completed_at))
      out.push({ key: `todo-${a.id}`, label: a.item, kind: "To-do", department: a.department });
    return out;
  }, [rocks, idsItems, actionItems, weekStartISO, weekEndISO]);

  const groups = useMemo(() => groupByDepartment(entries, (e) => e.department), [entries]);

  return (
    <SectionShell title="Completed since last meeting" count={entries.length} countLabel="done this week">
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs italic text-text-muted">Nothing closed in this week yet.</p>
      ) : (
        <div className="space-y-4 px-5 py-4">
          {groups.map((g) => (
            <div key={g.department}>
              <span className={`mb-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${getDepartmentClasses(g.department === "Unassigned" ? null : g.department)}`}>
                {g.department}
              </span>
              <ul className="space-y-1">
                {g.items.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 text-sm text-text-muted">
                    <span className="text-green-600">✓</span>
                    <span className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{e.kind}</span>
                    <span className="line-through">{e.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
