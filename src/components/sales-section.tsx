"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { OWNERS } from "@/lib/team";
import {
  CLOSING_SOON_DAYS,
  SALES_STAGES,
  formatValue,
  getStageClasses,
  isClosingSoon,
  isOpenDeal,
  isOverdue,
  todayIso,
  type SalesDeal
} from "@/lib/sales";
import { createSalesDeal, deleteSalesDeal, updateSalesDeal } from "@/lib/sales-actions";
import type { SalesStage, TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

// Sales pipeline — deals we're about to do. Won/Lost are hidden unless "Show
// closed" is on. The header tallies the open pipeline's total value.
export function SalesSection({ deals }: { deals: SalesDeal[] }) {
  const [showClosed, setShowClosed] = useState(false);
  const [closingSoon, setClosingSoon] = useState(false);
  const [adding, setAdding] = useState(false);

  // One clock read per render, threaded into the date helpers so they stay pure.
  const today = todayIso();

  const visible = useMemo(() => {
    // The two toggles intersect rather than override: `showClosed` decides
    // whether Won/Lost are in scope at all, `closingSoon` narrows by date.
    let filtered = showClosed ? deals : deals.filter(isOpenDeal);
    if (closingSoon) filtered = filtered.filter((d) => isClosingSoon(d, today));

    // In the closing-soon view, sort by date — soonest and overdue first, since
    // that's the axis being filtered on. Deals flagged without a date carry no
    // urgency signal, so they sort last rather than above an overdue deal (a
    // plain ascending sort would float their empty date to the top).
    if (closingSoon) {
      return [...filtered].sort((a, b) => {
        if (!a.expected_close && !b.expected_close) return 0;
        if (!a.expected_close) return 1;
        if (!b.expected_close) return -1;
        return a.expected_close.localeCompare(b.expected_close);
      });
    }
    const stageRank = Object.fromEntries(SALES_STAGES.map((s, i) => [s, i]));
    return [...filtered].sort((a, b) => {
      const sr = (stageRank[a.stage] ?? 99) - (stageRank[b.stage] ?? 99);
      if (sr !== 0) return sr;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [deals, showClosed, closingSoon, today]);

  const closingSoonCount = useMemo(
    () => deals.filter((d) => isOpenDeal(d) && isClosingSoon(d, today)).length,
    [deals, today]
  );

  const openValue = useMemo(
    () => deals.filter(isOpenDeal).reduce((sum, d) => sum + (d.value ?? 0), 0),
    [deals]
  );

  return (
    <SectionShell
      title="Sales"
      count={deals.filter(isOpenDeal).length}
      countLabel="in pipeline"
      rightSlot={
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-text-muted" title="Open pipeline value">
            {formatValue(openValue)} open
          </span>
          <button
            type="button"
            onClick={() => setClosingSoon((v) => !v)}
            aria-pressed={closingSoon}
            title={`Only deals with an expected close within ${CLOSING_SOON_DAYS} days (overdue included)`}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              closingSoon
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-surface text-text-muted hover:bg-surface-alt"
            )}
          >
            Closing ≤{CLOSING_SOON_DAYS}d
            {closingSoonCount > 0 && <span className="ml-1 font-semibold">({closingSoonCount})</span>}
          </button>
          <label className="flex items-center gap-1 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed
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
            {closingSoon
              ? `Nothing marked as closing within ${CLOSING_SOON_DAYS} days. Hit "○ Closing" on a deal — or give it an expected close date — to surface it here.`
              : "No deals in the pipeline yet."}
          </p>
        )}
        {visible.map((deal) => (
          <DealRow key={deal.id} deal={deal} today={today} />
        ))}
        {adding && <NewDealRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
      </div>
    </SectionShell>
  );
}

function DealRow({ deal, today }: { deal: SalesDeal; today: string }) {
  const [, startTransition] = useTransition();
  const closed = !isOpenDeal(deal);
  // Flag a slipped close date even in the unfiltered view — an open deal past
  // its date is the signal, so it shouldn't take a toggle to notice it.
  const overdue = !closed && isOverdue(deal, today);
  const hasNotes = Boolean(deal.notes && deal.notes.trim());
  // Auto-open the notes panel when there's already a note, so it's never hidden.
  const [showNotes, setShowNotes] = useState(hasNotes);
  return (
    <div className="px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        defaultValue={deal.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== deal.name) startTransition(() => updateSalesDeal(deal.id, { name: v }));
        }}
        placeholder="Deal / client"
        className={cn(
          "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-accent/50 focus:outline-none",
          closed ? "text-text-muted" : "text-text"
        )}
      />
      <div className="flex items-center text-sm text-text-muted">
        <span className="pl-2">$</span>
        <input
          type="number"
          defaultValue={deal.value ?? ""}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const v = raw === "" ? null : Number(raw);
            if (v !== (deal.value ?? null) && (v == null || !Number.isNaN(v))) {
              startTransition(() => updateSalesDeal(deal.id, { value: v }));
            }
          }}
          placeholder="0"
          className="w-24 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm text-text hover:border-border focus:border-accent/50 focus:outline-none"
          title="Deal value ($)"
        />
      </div>
      <select
        value={deal.owner ?? ""}
        onChange={(e) =>
          startTransition(() =>
            updateSalesDeal(deal.id, { owner: (e.target.value as TeamMember) || null })
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
      <input
        type="date"
        defaultValue={deal.expected_close ?? ""}
        onBlur={(e) => {
          const v = e.target.value || null;
          if (v !== (deal.expected_close ?? null)) {
            startTransition(() => updateSalesDeal(deal.id, { expected_close: v }));
          }
        }}
        className={cn(
          "rounded-md border bg-surface px-2 py-1 text-xs",
          overdue ? "border-red-300 font-semibold text-red-600" : "border-border text-text"
        )}
        title={overdue ? "Expected close — overdue" : "Expected close"}
      />
      <select
        value={deal.stage}
        onChange={(e) =>
          startTransition(() => updateSalesDeal(deal.id, { stage: e.target.value as SalesStage }))
        }
        className={cn(
          "cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold",
          getStageClasses(deal.stage)
        )}
        title="Stage"
      >
        {SALES_STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          startTransition(() => updateSalesDeal(deal.id, { closing_soon: !deal.closing_soon }))
        }
        aria-pressed={deal.closing_soon}
        title={
          deal.closing_soon
            ? `Flagged as closing within ${CLOSING_SOON_DAYS} days — click to clear`
            : `Flag as expected to close within ${CLOSING_SOON_DAYS} days`
        }
        className={cn(
          "flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
          deal.closing_soon
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-border bg-surface text-text-muted hover:bg-surface-alt"
        )}
      >
        {deal.closing_soon ? "● Closing" : "○ Closing"}
      </button>
      <button
        type="button"
        onClick={() => setShowNotes((v) => !v)}
        className={cn(
          "rounded-md border px-2 py-0.5 text-xs",
          hasNotes
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border bg-surface text-text-muted hover:bg-surface-alt"
        )}
        title={hasNotes ? "Notes" : "Add notes"}
        aria-expanded={showNotes}
      >
        {hasNotes ? "📝 Notes" : "＋ Note"}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this deal?")) startTransition(() => deleteSalesDeal(deal.id));
        }}
        className="text-xs text-text-muted hover:text-red-600"
      >
        ✕
      </button>
      </div>
      {showNotes && (
        <textarea
          defaultValue={deal.notes ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== (deal.notes ?? null)) {
              startTransition(() => updateSalesDeal(deal.id, { notes: v }));
            }
          }}
          placeholder="Notes on this lead — context, next step, blockers…"
          rows={2}
          className="mt-2 w-full resize-y rounded-md border border-border bg-surface-alt/30 px-2 py-1.5 text-xs text-text focus:border-accent/50 focus:outline-none"
        />
      )}
    </div>
  );
}

function NewDealRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [expectedClose, setExpectedClose] = useState("");
  const [stage, setStage] = useState<SalesStage>("Lead");
  const [notes, setNotes] = useState("");
  const [flagClosingSoon, setFlagClosingSoon] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = name.trim();
    if (!v) return;
    startTransition(async () => {
      await createSalesDeal({
        name: v,
        value: value.trim() === "" ? null : Number(value),
        owner: owner || null,
        expected_close: expectedClose || null,
        stage,
        notes: notes.trim() || null,
        closing_soon: flagClosingSoon
      });
      onSaved();
    });
  };

  return (
    <div className="bg-surface-alt/30 px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder="Deal / client name"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Value ($)"
        className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
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
      <input
        type="date"
        value={expectedClose}
        onChange={(e) => setExpectedClose(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Expected close"
      />
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value as SalesStage)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        title="Stage"
      >
        {SALES_STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setFlagClosingSoon((v) => !v)}
        aria-pressed={flagClosingSoon}
        title={`Flag as expected to close within ${CLOSING_SOON_DAYS} days`}
        className={cn(
          "flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
          flagClosingSoon
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-border bg-surface text-text-muted hover:bg-surface-alt"
        )}
      >
        {flagClosingSoon ? "● Closing" : "○ Closing"}
      </button>
      <button
        type="button"
        onClick={save}
        disabled={pending || !name.trim()}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
      >
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text">
        Cancel
      </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional) — context, next step, blockers…"
        rows={2}
        className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text focus:border-accent/50 focus:outline-none"
      />
    </div>
  );
}
