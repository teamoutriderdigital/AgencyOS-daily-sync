"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import { getDepartmentClasses } from "@/lib/department";
import { DEPARTMENTS } from "@/lib/department";
import { OWNERS } from "@/lib/team";
import type { Department } from "@/lib/database.types";
import {
  deleteDraftRock,
  saveDraftRock,
  setReviewCarry,
  setReviewDone,
  startNextQuarter
} from "@/lib/rocks-actions";
import type { RocksSnapshot } from "@/lib/rocks-server";
import {
  activeQuarter,
  draftPrefix,
  nextQuarter,
  parseDraft,
  quartersOf,
  reviewCarryKey,
  reviewStartedKey,
  type DraftRock,
  type Rock,
  type RockKv
} from "@/lib/rocks";
import { SectionShell } from "./section-shell";

// On the daily/weekly team list but not part of the quarterly rocks (Lianna is
// an SEO contractor). They still appear if a rock is ever assigned to them.
const NOT_ON_ROCKS: string[] = ["Lianna"];

// End-of-quarter review. Every rock gets two ticks: Done (unticked = not done)
// and Carry to next quarter (unticked = drop). Done writes the rock's status;
// Carry lives in rock_meeting_kv. Both stream over realtime so everyone in the
// meeting sees the same ticks.
export function QuarterlyBoard({
  initialSnapshot,
  requestedQuarter
}: {
  initialSnapshot: RocksSnapshot;
  requestedQuarter: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rocks, setRocks] = useState<Rock[]>(initialSnapshot.rocks);
  const [kv, setKv] = useState<Record<string, RockKv>>(() =>
    Object.fromEntries(initialSnapshot.kv.map((row) => [row.key, row] as [string, RockKv]))
  );

  useEffect(() => {
    const rocksChannel = supabase
      .channel("quarterly:rocks")
      .on("postgres_changes", { event: "*", schema: "public", table: "rocks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: number }).id;
          setRocks((prev) => prev.filter((r) => r.id !== id));
          return;
        }
        const row = payload.new as Rock;
        setRocks((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]));
      })
      .subscribe();
    const kvChannel = supabase
      .channel("quarterly:kv")
      .on("postgres_changes", { event: "*", schema: "public", table: "rock_meeting_kv" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldKey = (payload.old as { key: string }).key;
          setKv((prev) => {
            const next = { ...prev };
            delete next[oldKey];
            return next;
          });
          return;
        }
        const row = payload.new as RockKv;
        setKv((prev) => ({ ...prev, [row.key]: row }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(rocksChannel);
      supabase.removeChannel(kvChannel);
    };
  }, [supabase]);

  // Ticks flip locally at once; realtime then confirms (or another viewer's tick
  // arrives). A failed save reverts the tick.
  const tickDone = (rock: Rock, quarter: string, done: boolean) => {
    const prevStatus = rock.status;
    const optimistic = done ? "Done" : prevStatus === "Done" ? "On track" : prevStatus;
    setRocks((prev) => prev.map((r) => (r.id === rock.id ? { ...r, status: optimistic } : r)));
    setReviewDone(rock.id, quarter, done).catch((e) => {
      setRocks((prev) => prev.map((r) => (r.id === rock.id ? { ...r, status: prevStatus } : r)));
      window.alert(`Couldn't save: ${e instanceof Error ? e.message : e}`);
    });
  };
  const tickCarry = (rockId: number, quarter: string, carry: boolean) => {
    const key = reviewCarryKey(quarter, rockId);
    const setChecked = (checked: boolean) =>
      setKv((prev) => ({
        ...prev,
        [key]: { key, text_value: prev[key]?.text_value ?? null, checked, updated_at: new Date().toISOString() }
      }));
    setChecked(carry);
    setReviewCarry(rockId, quarter, carry).catch((e) => {
      setChecked(!carry);
      window.alert(`Couldn't save: ${e instanceof Error ? e.message : e}`);
    });
  };

  const putKv = (key: string, text_value: string | null) =>
    setKv((prev) => ({
      ...prev,
      [key]: { key, text_value, checked: prev[key]?.checked ?? false, updated_at: new Date().toISOString() }
    }));
  const dropKv = (key: string) =>
    setKv((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const saveDraft = (key: string, draft: DraftRock) => {
    const before = kv[key];
    putKv(key, JSON.stringify(draft));
    saveDraftRock(key, draft).catch((e) => {
      if (before) putKv(key, before.text_value);
      else dropKv(key);
      window.alert(`Couldn't save: ${e instanceof Error ? e.message : e}`);
    });
  };
  const removeDraft = (key: string) => {
    const before = kv[key];
    dropKv(key);
    deleteDraftRock(key).catch((e) => {
      if (before) putKv(key, before.text_value);
      window.alert(`Couldn't delete: ${e instanceof Error ? e.message : e}`);
    });
  };

  const quarters = useMemo(() => quartersOf(rocks), [rocks]);
  const quarter =
    requestedQuarter && quarters.includes(requestedQuarter) ? requestedQuarter : activeQuarter(rocks);
  const target = nextQuarter(quarter);

  const forQuarter = useMemo(
    () => rocks.filter((r) => r.quarter === quarter).sort((a, b) => a.sort_order - b.sort_order),
    [rocks, quarter]
  );
  // Drafts for the next quarter, keyed draft:<target>:<timestamp>-<rand> so key
  // order is creation order and rows don't jump while being edited.
  const drafts = useMemo(
    () =>
      Object.values(kv)
        .filter((row) => row.key.startsWith(draftPrefix(target)))
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((row) => ({ key: row.key, draft: parseDraft(row) }))
        .filter((d): d is { key: string; draft: DraftRock } => d.draft !== null),
    [kv, target]
  );
  // One section per team member on quarterly rocks (even with no rocks this
  // quarter, so they can be given drafts), then anyone else who owns a rock.
  const groups = useMemo(() => {
    const names: string[] = OWNERS.filter((o) => !NOT_ON_ROCKS.includes(o));
    for (const r of forQuarter) {
      const o = r.owner?.trim() || "Unassigned";
      if (!names.includes(o)) names.push(o);
    }
    return names.map((owner) => ({
      owner,
      rocks: forQuarter.filter((r) => (r.owner?.trim() || "Unassigned") === owner),
      drafts: drafts.filter((d) => d.draft.owner === owner)
    }));
  }, [forQuarter, drafts]);
  const isCarried = (id: number) => kv[reviewCarryKey(quarter, id)]?.checked ?? false;
  const doneCount = forQuarter.filter((r) => r.status === "Done").length;
  const carryCount = forQuarter.filter((r) => isCarried(r.id)).length;
  const donePct = forQuarter.length ? Math.round((doneCount / forQuarter.length) * 100) : 0;
  const started = kv[reviewStartedKey(quarter)];
  const targetHasRocks = rocks.some((r) => r.quarter === target);
  const draftCount = drafts.filter((d) => d.draft.title.trim() !== "").length;
  const drafting = !started?.checked && !targetHasRocks;

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text">{quarter} quarterly review</h1>
          <p className="text-sm text-text-muted">
            Tick <strong>Done</strong> if the rock is finished (unticked = not done). Tick{" "}
            <strong>Carry to {target}</strong> if it continues next quarter (unticked = drop).
          </p>
        </div>
        {quarters.length > 1 && (
          <nav className="flex gap-1">
            {quarters.map((q) => (
              <Link
                key={q}
                href={`/quarterly?q=${encodeURIComponent(q)}`}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  q === quarter ? "border-accent bg-accent text-text-inverse" : "border-border text-text-muted hover:bg-surface-alt"
                )}
              >
                {q}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <Stat label="Rocks" value={String(forQuarter.length)} />
        <Stat label="Done" value={`${doneCount} · ${donePct}%`} />
        <Stat label="Not done" value={String(forQuarter.length - doneCount)} />
        <Stat label={`Carry to ${target}`} value={String(carryCount)} />
        <Stat label="Drop" value={String(forQuarter.length - carryCount)} />
        <Stat label={`New ${target.split(" ")[0]} drafts`} value={String(draftCount)} />
      </div>

      {groups.map((g) => (
          <SectionShell
            key={g.owner}
            title={g.owner}
            count={g.rocks.length}
            countLabel={g.rocks.length === 1 ? "rock" : "rocks"}
            rightSlot={
              <span className="text-xs text-text-muted">
                {g.rocks.filter((r) => r.status === "Done").length} done ·{" "}
                {g.rocks.filter((r) => isCarried(r.id)).length} carry
              </span>
            }
          >
            {g.rocks.length === 0 && (
              <p className="px-5 pt-3 text-xs italic text-text-muted">No rocks in {quarter}.</p>
            )}
            <ul className="divide-y divide-border/50">
              {g.rocks.map((rock) => (
                <ReviewRow
                  key={rock.id}
                  rock={rock}
                  target={target}
                  carried={isCarried(rock.id)}
                  onDone={(v) => tickDone(rock, quarter, v)}
                  onCarry={(v) => tickCarry(rock.id, quarter, v)}
                />
              ))}
            </ul>
            {drafting && (
              <DraftBox
                owner={g.owner}
                target={target}
                drafts={g.drafts}
                onSave={saveDraft}
                onRemove={removeDraft}
              />
            )}
          </SectionShell>
        ))}

      <StartNextQuarter
        quarter={quarter}
        target={target}
        carryCount={carryCount}
        draftCount={draftCount}
        startedNote={started?.checked ? started.text_value : null}
        targetHasRocks={targetHasRocks}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-border bg-surface px-3 py-1.5">
      <span className="text-text-muted">{label}: </span>
      <span className="font-semibold tabular-nums text-text">{value}</span>
    </span>
  );
}

function ReviewRow({
  rock,
  target,
  carried,
  onDone,
  onCarry
}: {
  rock: Rock;
  target: string;
  carried: boolean;
  onDone: (v: boolean) => void;
  onCarry: (v: boolean) => void;
}) {
  const done = rock.status === "Done";
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium text-text", done && "line-through decoration-text-muted/60")}>
          {rock.title || "(untitled rock)"}
        </p>
        {rock.smart && <p className="mt-0.5 text-xs text-text-muted">{rock.smart}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
          {rock.department && (
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", getDepartmentClasses(rock.department))}>
              {rock.department}
            </span>
          )}
          {rock.progress_note && <span>{rock.progress_note}</span>}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Tick
          label="Done"
          checked={done}
          tone="blue"
          onChange={onDone}
        />
        <Tick
          label={`Carry to ${target.split(" ")[0]}`}
          checked={carried}
          tone="green"
          onChange={onCarry}
        />
      </div>
    </li>
  );
}

function Tick({
  label,
  checked,
  tone,
  onChange
}: {
  label: string;
  checked: boolean;
  tone: "blue" | "green";
  onChange: (v: boolean) => void;
}) {
  const on = tone === "blue" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-green-300 bg-green-50 text-green-700";
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        checked ? on : "border-border bg-surface text-text-muted hover:bg-surface-alt"
      )}
    >
      <input type="checkbox" className="h-3.5 w-3.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function StartNextQuarter({
  quarter,
  target,
  carryCount,
  draftCount,
  startedNote,
  targetHasRocks
}: {
  quarter: string;
  target: string;
  carryCount: number;
  draftCount: number;
  startedNote: string | null | undefined;
  targetHasRocks: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (startedNote || targetHasRocks) {
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
        {startedNote ? `✓ ${startedNote}.` : `${target} already has rocks.`}{" "}
        <Link href={`/quarterly?q=${encodeURIComponent(target)}`} className="font-semibold underline">
          Open {target}
        </Link>
      </p>
    );
  }

  const start = () => {
    if (
      !window.confirm(
        `Start ${target} with ${carryCount} carried rocks and ${draftCount} new draft rocks? They all start as On track. ${quarter} stays as it is.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await startNextQuarter(quarter);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
      <p className="text-sm text-text-muted">
        When every rock is ticked and the drafts are written, start {target}: {carryCount} carried + {draftCount} new
        rocks. The weekly board then switches to {target}.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={pending || carryCount + draftCount === 0}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-text-inverse shadow-sm disabled:opacity-50"
      >
        {pending ? "Starting…" : `Start ${target} →`}
      </button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}

// Per-person drafting space for next quarter's rocks. Drafts save as you type
// (on blur) and stay drafts until "Start" turns them into real rocks.
function DraftBox({
  owner,
  target,
  drafts,
  onSave,
  onRemove
}: {
  owner: string;
  target: string;
  drafts: { key: string; draft: DraftRock }[];
  onSave: (key: string, draft: DraftRock) => void;
  onRemove: (key: string) => void;
}) {
  const add = () => {
    const key = `${draftPrefix(target)}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onSave(key, { owner, title: "", smart: "", department: null });
  };
  return (
    <div className="border-t border-dashed border-border bg-surface-alt/30 px-5 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {target.split(" ")[0]} draft rocks · {owner}
      </p>
      {drafts.length > 0 && (
        <ul className="mb-2 space-y-2">
          {drafts.map((d) => (
            <DraftRow key={d.key} draftKey={d.key} draft={d.draft} onSave={onSave} onRemove={onRemove} />
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="rounded-md border border-dashed border-border px-3 py-1 text-xs font-medium text-text-muted hover:bg-surface hover:text-text"
      >
        + Add {target.split(" ")[0]} rock for {owner}
      </button>
    </div>
  );
}

function DraftRow({
  draftKey,
  draft,
  onSave,
  onRemove
}: {
  draftKey: string;
  draft: DraftRock;
  onSave: (key: string, draft: DraftRock) => void;
  onRemove: (key: string) => void;
}) {
  const [title, setTitle] = useState(draft.title);
  const [smart, setSmart] = useState(draft.smart);
  // Another viewer's edit arrives over realtime — take it unless we're mid-edit.
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) {
      setTitle(draft.title);
      setSmart(draft.smart);
    }
  }, [draft.title, draft.smart, focused]);

  const commit = (patch: Partial<DraftRock>) => {
    const next = { ...draft, title, smart, ...patch };
    if (next.title !== draft.title || next.smart !== draft.smart || next.department !== draft.department) {
      onSave(draftKey, next);
    }
  };
  const input =
    "w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text placeholder:text-text-muted/70 focus:border-accent focus:outline-none";

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 sm:flex-row sm:items-start">
      <div className="flex-1 space-y-1.5">
        <input
          className={cn(input, "font-medium")}
          placeholder="Rock title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit({ title });
          }}
        />
        <input
          className={cn(input, "text-xs")}
          placeholder="Done when… (one measurable sentence)"
          value={smart}
          onChange={(e) => setSmart(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit({ smart });
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <select
          value={draft.department ?? ""}
          onChange={(e) => commit({ department: (e.target.value || null) as Department | null })}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
          title="Department"
        >
          <option value="">Department…</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(draftKey)}
          className="rounded-md px-2 py-1 text-sm text-text-muted hover:bg-red-50 hover:text-red-700"
          title="Delete draft"
          aria-label="Delete draft"
        >
          ×
        </button>
      </div>
    </li>
  );
}
