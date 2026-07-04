"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import { setMeetingValue } from "@/lib/rocks-actions";
import type { RocksSnapshot } from "@/lib/rocks-server";
import type { Rock, RockKv } from "@/lib/rocks";
import {
  COLLISIONS,
  DECISIONS,
  FACILITATOR_KEY,
  IMMEDIATES,
  MEETING_DATE,
  OWNER_REFERENCE,
  RUN_OF_SHOW
} from "@/lib/rocks";
import { RockLockCard } from "./rock-lock-card";
import { RocksTable } from "./rocks-table";
import { RockChecklist } from "./rock-checklist";

const ROSTER = ["Jack", "Daniel", "Darko*", "Leo", "Rehan", "Kas", "Mustafa"];

function sortRocks(list: Rock[]): Rock[] {
  return [...list].sort(
    (a, b) => a.sort_order - b.sort_order || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// The Q3 Rocks decision-meeting board. Unlike the daily standup this is shared
// live state with no date scope — rocks + keyed meeting values stream over
// Supabase realtime so the whole team edits the same board during the sync.
export function RocksBoard({ initialSnapshot }: { initialSnapshot: RocksSnapshot }) {
  const supabase = useMemo(() => createClient(), []);
  const [rocks, setRocks] = useState<Rock[]>(sortRocks(initialSnapshot.rocks));
  const [kv, setKv] = useState<Record<string, RockKv>>(() =>
    Object.fromEntries(initialSnapshot.kv.map((row) => [row.key, row] as [string, RockKv]))
  );

  useEffect(() => {
    const rocksChannel = supabase
      .channel("rocks:rocks")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rocks" }, (payload) =>
        setRocks((prev) => {
          const row = payload.new as Rock;
          return prev.some((r) => r.id === row.id) ? prev : sortRocks([...prev, row]);
        })
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rocks" }, (payload) =>
        setRocks((prev) =>
          sortRocks(prev.map((r) => (r.id === (payload.new as Rock).id ? (payload.new as Rock) : r)))
        )
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "rocks" }, (payload) =>
        setRocks((prev) => prev.filter((r) => r.id !== (payload.old as { id: number }).id))
      )
      .subscribe();

    const kvChannel = supabase
      .channel("rocks:kv")
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

  // ─── kv helpers (optimistic local write + persist) ────────────────────────
  const kvText = (key: string) => kv[key]?.text_value ?? "";
  const kvChecked = (key: string) => kv[key]?.checked ?? false;
  const writeKv = (key: string, patch: { text_value?: string | null; checked?: boolean }) => {
    setKv((prev) => ({
      ...prev,
      [key]: {
        key,
        text_value: patch.text_value ?? prev[key]?.text_value ?? null,
        checked: patch.checked ?? prev[key]?.checked ?? false,
        updated_at: prev[key]?.updated_at ?? ""
      }
    }));
    void setMeetingValue(key, patch);
  };

  const lockedCount = [...DECISIONS, ...COLLISIONS].filter((d) => kvChecked(d.key)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-l-4 border-l-accent px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Outrider Digital · Quarterly Rocks · L10 Decision Sync
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
            Finalize &amp; assign the <span className="text-accent">Q3 rocks</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
            <span className="font-semibold text-text">{MEETING_DATE}</span>
            <span className="font-medium text-red-600">◆ Decision meeting — not another ideation round</span>
            <span>Yesterday was the brain-dump; today we lock owners, “done,” and dates.</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ROSTER.map((name) => (
              <span
                key={name}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-text-muted"
              >
                {name}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="facilitator" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Facilitator
            </label>
            <input
              id="facilitator"
              type="text"
              defaultValue={kvText(FACILITATOR_KEY)}
              placeholder="assign a name — someone must drive this"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== kvText(FACILITATOR_KEY).trim()) writeKv(FACILITATOR_KEY, { text_value: v });
              }}
              className="min-w-[14rem] rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-text-muted">*Darko was absent yesterday — confirm his 3 rocks live</span>
          </div>
        </div>
        <p className="border-t border-border bg-amber-50 px-5 py-2.5 text-sm text-amber-900 sm:px-7">
          <span className="font-semibold">The rule:</span> every rock leaves this room with one owner, a
          one-sentence definition of done, and a deadline — or it&apos;s not a rock yet.
        </p>
      </header>

      {/* ── A · Run of show ────────────────────────────────────────────── */}
      <Section letter="A" title="Run of show" sub="65 minutes, in order. Items 7–8 stay locked until 1 and 6 are done — you can't date a rock before cadence and dependencies exist.">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {RUN_OF_SHOW.map((r) => (
            <div
              key={r.n}
              className="flex items-baseline gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0"
            >
              <span className="font-display text-sm font-bold text-accent">{r.n}</span>
              <span className="flex-1 text-sm text-text">
                <span className="font-semibold">{r.title}</span>{" "}
                <span className="text-text-muted">{r.detail}</span>
              </span>
              <span className="whitespace-nowrap rounded-md border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-muted">
                {r.box}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border bg-surface-alt px-4 py-2.5 text-xs text-text-muted">
            <span>Total</span>
            <span>
              <span className="font-semibold text-text">65 min</span> · then the finalized rocks go straight into
              the Master Dashboard
            </span>
          </div>
        </div>
      </Section>

      {/* ── B · Decisions to lock ──────────────────────────────────────── */}
      <Section
        letter="B"
        title="Four decisions to lock"
        sub="Each has a recommendation so you're choosing, not re-arguing. Type the call, hit Lock. The card turns green."
        badge={`${lockedCount} / ${DECISIONS.length + COLLISIONS.length} locked`}
      >
        <div className="grid gap-3">
          {DECISIONS.map((d) => (
            <RockLockCard
              key={d.key}
              accent="warn"
              locked={kvChecked(d.key)}
              recommend={d.recommend}
              lockLabel={d.lockLabel}
              placeholder={d.placeholder}
              defaultText={kvText(d.key)}
              onCommitText={(v) => writeKv(d.key, { text_value: v })}
              onToggleLock={(next) => writeKv(d.key, { checked: next })}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-sm font-bold text-accent">{d.n}</span>
                <h3 className="font-display text-base font-semibold text-text">{d.title}</h3>
              </div>
              <p className="mt-1 text-sm text-text-muted">{d.frame}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {d.options.map((o) => (
                  <span key={o.k} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs">
                    <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                      {o.k}
                    </span>
                    {o.label}
                  </span>
                ))}
              </div>
            </RockLockCard>
          ))}
        </div>
      </Section>

      {/* ── C · Collisions ─────────────────────────────────────────────── */}
      <Section
        letter="C"
        title="Ownership collisions — resolve before dating"
        sub="These overlaps are why yesterday couldn't assign dates. One name each. Write the resolution and lock it."
      >
        <div className="grid gap-3">
          {COLLISIONS.map((c) => (
            <RockLockCard
              key={c.key}
              accent="flag"
              locked={kvChecked(c.key)}
              recommend={c.recommend}
              lockLabel="Resolved →"
              placeholder={c.placeholder}
              defaultText={kvText(c.key)}
              onCommitText={(v) => writeKv(c.key, { text_value: v })}
              onToggleLock={(next) => writeKv(c.key, { checked: next })}
            >
              <span
                className={cn(
                  "inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  kvChecked(c.key) ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"
                )}
              >
                {kvChecked(c.key) ? "Resolved" : c.tag}
              </span>
              <h3 className="mt-2 font-display text-base font-semibold text-text">{c.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.parties.map((p, i) => (
                  <span key={p.who} className="flex items-center gap-2">
                    {i > 0 && <span className="font-mono text-xs text-red-500">×</span>}
                    <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text">
                      <span className="font-mono text-[11px] font-semibold text-accent">{p.who}</span>{" "}
                      <span className="text-text-muted">— {p.note}</span>
                      {p.flag && (
                        <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-600">
                          {p.flag}
                        </span>
                      )}
                    </span>
                  </span>
                ))}
              </div>
            </RockLockCard>
          ))}
        </div>
      </Section>

      {/* ── D · Owner reference ────────────────────────────────────────── */}
      <Section
        letter="D"
        title="Who owns what — reference"
        sub="Yesterday's brain-dump, per person. Read it into the rocks table below; don't re-open unless a collision touches it."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OWNER_REFERENCE.map((o) => (
            <div
              key={o.name}
              className={cn(
                "rounded-2xl border bg-surface p-4 shadow-sm",
                o.absent ? "border-dashed border-red-200" : "border-border"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-text">{o.name}</h3>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    o.flag ? "rounded bg-red-50 px-1.5 py-0.5 text-red-600" : "font-mono text-text-muted"
                  )}
                >
                  {o.count}
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {o.rocks.map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] leading-snug text-text">
                    <span className="mt-0.5 text-[10px] text-accent">▸</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ── E · Rocks table (the deliverable) ──────────────────────────── */}
      <Section
        letter="E"
        title="The deliverable"
        sub="One owner, a type, a one-sentence “done,” a deadline. Seed the drafts, then refine each cell live — edits save and stream to everyone."
      >
        <RocksTable rocks={rocks} />
      </Section>

      {/* ── F · Immediates ─────────────────────────────────────────────── */}
      <Section letter="F" title="This week + daily rhythm" sub="Agenda item 8 — what moves before the next sprint even starts.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IMMEDIATES.map((t) => (
            <div
              key={t.title}
              className={cn(
                "rounded-2xl border bg-surface p-4 shadow-sm",
                t.hot ? "border-border border-l-4 border-l-accent" : "border-border"
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{t.when}</p>
              <h3 className="mt-1.5 font-display text-sm font-semibold text-text">{t.title}</h3>
              <p className="mt-1 text-xs text-text-muted">{t.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── G · Exit checklist ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <span className="font-mono text-xs font-bold text-accent">G</span>
        <RockChecklist checked={kvChecked} onToggle={(key, next) => writeKv(key, { checked: next })} />
      </section>
    </div>
  );
}

function Section({
  letter,
  title,
  sub,
  badge,
  children
}: {
  letter: string;
  title: string;
  sub: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-bold text-accent">{letter}</span>
          <h2 className="font-display text-lg font-bold tracking-tight text-text">{title}</h2>
          {badge && (
            <span className="ml-auto rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-text-muted">
              {badge}
            </span>
          )}
        </div>
        {sub && <p className="mt-1 text-sm text-text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}
