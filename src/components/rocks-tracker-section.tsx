"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ROCK_OWNERS, type Rock } from "@/lib/rocks";
import { setRockStatus } from "@/lib/rocks-actions";
import type { RockStatus } from "@/lib/database.types";
import { getDepartmentClasses } from "@/lib/department";
import { summaryKey } from "@/lib/summaries";
import type { ItemSummary } from "@/lib/summaries";
import { SectionShell } from "./section-shell";

const ROCK_STATUSES: RockStatus[] = ["On track", "Off track", "Done"];

function statusClasses(status: RockStatus): string {
  switch (status) {
    case "On track":
      return "border-green-200 bg-green-50 text-green-700";
    case "Off track":
      return "border-red-200 bg-red-50 text-red-700";
    case "Done":
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function pctBadgeClasses(pct: number): string {
  return pct === 100
    ? "border-green-200 bg-green-50 text-green-700"
    : pct >= 60
      ? "border-yellow-200 bg-yellow-50 text-yellow-700"
      : "border-red-200 bg-red-50 text-red-700";
}

// "On track" counts anything not Off track (Done rocks are wins, not risks).
function onTrackPctFor(rocks: Rock[]): number {
  if (rocks.length === 0) return 0;
  const good = rocks.filter((r) => r.status !== "Off track").length;
  return Math.round((good / rocks.length) * 100);
}

// Group by owner, keeping the known roster order first, then any extras.
function groupByOwner(rocks: Rock[]): { owner: string; rocks: Rock[] }[] {
  const byOwner = new Map<string, Rock[]>();
  for (const r of rocks) {
    const key = r.owner?.trim() || "Unassigned";
    const list = byOwner.get(key) ?? [];
    list.push(r);
    byOwner.set(key, list);
  }
  const ordered: string[] = [];
  for (const name of ROCK_OWNERS) if (byOwner.has(name)) ordered.push(name);
  for (const name of byOwner.keys()) if (!ordered.includes(name)) ordered.push(name);
  return ordered.map((owner) => ({ owner, rocks: byOwner.get(owner) ?? [] }));
}

// Weekly rock review, collapsed per person: one toggle per owner (name, rock
// count, on-track %), expand to see their rocks. Department shows as a chip on
// each card. Team on-track % ("on track" = anything not Off track) is in the
// section header.
export function RocksTrackerSection({
  rocks,
  quarter,
  summaries
}: {
  rocks: Rock[];
  quarter: string;
  summaries: Map<string, ItemSummary>;
}) {
  const forQuarter = useMemo(() => rocks.filter((r) => r.quarter === quarter), [rocks, quarter]);
  const onTrackPct = useMemo(() => onTrackPctFor(forQuarter), [forQuarter]);
  const ownerGroups = useMemo(() => groupByOwner(forQuarter), [forQuarter]);

  return (
    <SectionShell
      title="Rocks"
      count={forQuarter.length}
      countLabel={`for ${quarter}`}
      rightSlot={
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", pctBadgeClasses(onTrackPct))}>
          {onTrackPct}% On Track
        </span>
      }
    >
      {forQuarter.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs italic text-text-muted">
          No rocks for {quarter} yet. Set them in the Finalize &amp; Assign board.
        </p>
      ) : (
        <div className="divide-y divide-border/50">
          {ownerGroups.map((g) => (
            <OwnerGroup key={g.owner} owner={g.owner} rocks={g.rocks} summaries={summaries} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function OwnerGroup({
  owner,
  rocks,
  summaries
}: {
  owner: string;
  rocks: Rock[];
  summaries: Map<string, ItemSummary>;
}) {
  const [open, setOpen] = useState(false);
  const pct = onTrackPctFor(rocks);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-surface-alt/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{open ? "▾" : "▸"}</span>
          <span className="text-sm font-semibold text-text">{owner}</span>
          <span className="text-xs font-normal text-text-muted">({rocks.length})</span>
        </span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", pctBadgeClasses(pct))}>
          {pct}% On Track
        </span>
      </button>
      {open && (
        <div className="grid gap-2 px-5 pb-4 sm:grid-cols-2">
          {rocks.map((rock) => (
            <RockCard key={rock.id} rock={rock} summaries={summaries} />
          ))}
        </div>
      )}
    </div>
  );
}

function RockCard({ rock, summaries }: { rock: Rock; summaries: Map<string, ItemSummary> }) {
  const [, startTransition] = useTransition();
  return (
    <div className="rounded-lg border border-border bg-surface-alt/40 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text" title={rock.title}>
            {rock.title || "(untitled rock)"}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-muted">
            <span>{rock.rock_type}</span>
            {rock.department && (
              <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold normal-case", getDepartmentClasses(rock.department))}>
                {rock.department}
              </span>
            )}
            {rock.progress_note && (
              <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums normal-case text-text-muted">
                {rock.progress_note}
              </span>
            )}
          </p>
        </div>
        <select
          value={rock.status}
          onChange={(e) => startTransition(() => setRockStatus(rock.id, e.target.value as RockStatus))}
          className={cn(
            "shrink-0 cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
            statusClasses(rock.status)
          )}
          title="Status"
        >
          {ROCK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {rock.smart && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{rock.smart}</p>}
      {summaries.get(summaryKey("rock", rock.id)) && (
        <p className="mt-1 rounded bg-surface-alt/60 px-2 py-1 text-[11px] italic text-text-muted">
          <span className="font-semibold not-italic">Last meeting: </span>
          {summaries.get(summaryKey("rock", rock.id))!.summary}
        </p>
      )}
    </div>
  );
}
