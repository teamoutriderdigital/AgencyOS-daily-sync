"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ActionItem, IdsItem } from "@/lib/l10";
import { todayLocalISO } from "@/lib/l10";
import type { Rock } from "@/lib/rocks";
import { QUARTER } from "@/lib/rocks";
import type { Client } from "@/lib/clients";
import type { MeetingRating } from "@/lib/daily";
import type { WeeklySnapshot } from "@/lib/weekly-server";
import {
  currentIsoWeek,
  isoWeekLabel,
  isoWeekRangeLabel,
  isoWeekStart,
  itemInWeek,
  shiftIsoWeek,
  type IsoWeek
} from "@/lib/weekly";
import { triggerWeeklySync } from "@/lib/l10-actions";
import type { Innovation } from "@/lib/innovations";
import { indexSummaries, type ItemSummary } from "@/lib/summaries";
import type { SalesDeal } from "@/lib/sales";
import { IdsSection } from "./ids-section";
import { SalesSection } from "./sales-section";
import { ActionItemsSection } from "./action-items-section";
import { RocksTrackerSection } from "./rocks-tracker-section";
import { RatingSection } from "./rating-section";
import { CompletedSection } from "./completed-section";
import { InnovationSection } from "./innovation-section";
import { HeadlinesSection } from "./headlines-section";
import { NextWeekSection } from "./next-week-section";

type Props = { initialSnapshot: WeeklySnapshot };

// Weekly L10 board. To-dos, IDS and rocks are shared master state (same realtime
// wiring as the daily board); the ISO-week selector filters to-dos + issues to
// the chosen week, and "Sync previous week items" rolls open items forward.
export function WeeklyBoard({ initialSnapshot }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const current = useMemo(() => currentIsoWeek(), []);

  const [selected, setSelected] = useState<IsoWeek>(current);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialSnapshot.actionItems);
  const [idsItems, setIdsItems] = useState<IdsItem[]>(initialSnapshot.idsItems);
  const [rocks, setRocks] = useState<Rock[]>(initialSnapshot.rocks);
  const [clients, setClients] = useState<Client[]>(initialSnapshot.clients);
  const [ratings, setRatings] = useState<MeetingRating[]>(initialSnapshot.ratings);
  const [innovations, setInnovations] = useState<Innovation[]>(initialSnapshot.innovations);
  const [summaries, setSummaries] = useState<ItemSummary[]>(initialSnapshot.summaries);
  const [salesDeals, setSalesDeals] = useState<SalesDeal[]>(initialSnapshot.salesDeals);
  const [syncing, startSync] = useTransition();

  // A week's meeting rating is stored under that week's Monday (UTC).
  const ratingDate = useMemo(
    () => isoWeekStart(selected.year, selected.week).toISOString().slice(0, 10),
    [selected]
  );

  // Bounds for the Completed section, which filters rocks/IDS/to-dos by
  // completed_at falling within the selected ISO week.
  const weekStartISO = useMemo(
    () => isoWeekStart(selected.year, selected.week).toISOString().slice(0, 10),
    [selected]
  );
  const weekEndISO = useMemo(() => {
    const d = isoWeekStart(selected.year, selected.week);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [selected]);

  // ─── Live master tables (to-dos + IDS + rocks) ────────────────────────────
  useEffect(() => {
    const actionChannel = supabase
      .channel("weekly:action_items")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_items" }, (payload) =>
        setActionItems((prev) =>
          prev.some((p) => p.id === (payload.new as ActionItem).id) ? prev : [...prev, payload.new as ActionItem]
        )
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "action_items" }, (payload) =>
        setActionItems((prev) =>
          prev.map((p) => (p.id === (payload.new as ActionItem).id ? (payload.new as ActionItem) : p))
        )
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "action_items" }, (payload) =>
        setActionItems((prev) => prev.filter((p) => p.id !== (payload.old as { id: number }).id))
      )
      .subscribe();

    const idsChannel = supabase
      .channel("weekly:ids_items")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ids_items" }, (payload) => {
        const row = payload.new as IdsItem;
        if (row.archived) return;
        setIdsItems((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ids_items" }, (payload) => {
        const row = payload.new as IdsItem;
        setIdsItems((prev) =>
          row.archived ? prev.filter((p) => p.id !== row.id) : prev.map((p) => (p.id === row.id ? row : p))
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ids_items" }, (payload) =>
        setIdsItems((prev) => prev.filter((p) => p.id !== (payload.old as { id: number }).id))
      )
      .subscribe();

    const rocksChannel = supabase
      .channel("weekly:rocks")
      .on("postgres_changes", { event: "*", schema: "public", table: "rocks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setRocks((prev) => prev.filter((r) => r.id !== oldId));
          return;
        }
        const row = payload.new as Rock;
        setRocks((prev) => {
          const idx = prev.findIndex((r) => r.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    const clientsChannel = supabase
      .channel("weekly:clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setClients((prev) => prev.filter((c) => c.id !== oldId));
          return;
        }
        const row = payload.new as Client;
        setClients((prev) => {
          const idx = prev.findIndex((c) => c.id === row.id);
          const next = idx === -1 ? [...prev, row] : prev.map((c) => (c.id === row.id ? row : c));
          // Keep the same (sort_order, name) order the server snapshot uses, so
          // a newly-inserted client lands in the right spot without a reload.
          return next.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
        });
      })
      .subscribe();

    const innovationsChannel = supabase
      .channel("weekly:innovations")
      .on("postgres_changes", { event: "*", schema: "public", table: "innovations" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setInnovations((prev) => prev.filter((i) => i.id !== oldId));
          return;
        }
        const row = payload.new as Innovation;
        setInnovations((prev) => {
          const idx = prev.findIndex((i) => i.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    // Mirrors daily:sales_deals — the pipeline is one master list, so a stage
    // change made on the daily board lands here mid-meeting.
    const salesChannel = supabase
      .channel("weekly:sales_deals")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_deals" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setSalesDeals((prev) => prev.filter((d) => d.id !== oldId));
          return;
        }
        const row = payload.new as SalesDeal;
        setSalesDeals((prev) => {
          const idx = prev.findIndex((d) => d.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(actionChannel);
      supabase.removeChannel(idsChannel);
      supabase.removeChannel(rocksChannel);
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(innovationsChannel);
      supabase.removeChannel(salesChannel);
    };
  }, [supabase]);

  // ─── Meeting ratings — scoped to the selected week's Monday ────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("meeting_ratings")
        .select("*")
        .eq("rating_date", ratingDate);
      if (!active || error) return;
      setRatings(data ?? []);
    })();

    const ratingChannel = supabase
      .channel(`weekly:ratings:${ratingDate}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_ratings" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setRatings((prev) => prev.filter((r) => r.id !== oldId));
          return;
        }
        const row = payload.new as MeetingRating;
        if (row.rating_date !== ratingDate) return;
        setRatings((prev) => {
          const idx = prev.findIndex((r) => r.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ratingChannel);
    };
  }, [supabase, ratingDate]);

  // ─── Cached AI summaries — scoped to the selected ISO week ─────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("item_summaries")
        .select("*")
        .eq("week_number", selected.week)
        .eq("year_number", selected.year);
      if (!active || error) return;
      setSummaries(data ?? []);
    })();

    const summariesChannel = supabase
      .channel(`weekly:item_summaries:${selected.year}-${selected.week}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "item_summaries" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setSummaries((prev) => prev.filter((s) => s.id !== oldId));
          return;
        }
        const row = payload.new as ItemSummary;
        if (row.week_number !== selected.week || row.year_number !== selected.year) return;
        setSummaries((prev) => {
          const idx = prev.findIndex((s) => s.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(summariesChannel);
    };
  }, [supabase, selected]);

  const summaryIndex = useMemo(() => indexSummaries(summaries), [summaries]);
  const clientNames = useMemo(() => clients.map((c) => c.name), [clients]);
  const clientStages = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.name, c.stage])),
    [clients]
  );
  const weekActions = useMemo(
    () => actionItems.filter((i) => itemInWeek(i, selected, current, !i.done)),
    [actionItems, selected, current]
  );
  const weekIds = useMemo(
    () => idsItems.filter((i) => !i.archived && i.status !== "Solved" && itemInWeek(i, selected, current, true)),
    [idsItems, selected, current]
  );
  const carriedCount = useMemo(
    () =>
      weekActions.filter((i) => i.carried_from_week != null).length +
      weekIds.filter((i) => i.carried_from_week != null).length,
    [weekActions, weekIds]
  );

  const isCurrent = selected.year === current.year && selected.week === current.week;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected((w) => shiftIsoWeek(w, -1))}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text hover:bg-surface-alt"
              aria-label="Previous week"
            >
              ‹
            </button>
            <h1 className="font-display text-lg font-semibold tracking-tight text-text">
              {isoWeekLabel(selected)}
            </h1>
            <button
              type="button"
              onClick={() => setSelected((w) => shiftIsoWeek(w, 1))}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text hover:bg-surface-alt"
              aria-label="Next week"
            >
              ›
            </button>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => setSelected(current)}
                className="text-xs text-accent hover:underline"
              >
                Jump to this week
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {isoWeekRangeLabel(selected)} · weekly L10 — rocks, IDS, to-dos, and meeting rating for the week.
          </p>
        </div>

        <button
          type="button"
          onClick={() => startSync(() => triggerWeeklySync(selected.year, selected.week))}
          disabled={syncing}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
          title="Roll every still-open to-do and issue from earlier weeks into this week"
        >
          {syncing ? "Syncing…" : "↻ Sync previous week items"}
        </button>
      </div>

      {carriedCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {carriedCount} item{carriedCount === 1 ? "" : "s"} carried over into {isoWeekLabel(selected)}.
        </div>
      )}

      <CompletedSection
        rocks={rocks}
        idsItems={idsItems}
        actionItems={actionItems}
        weekStartISO={weekStartISO}
        weekEndISO={weekEndISO}
      />
      <HeadlinesSection
        headlines={initialSnapshot.dailyHeadlines}
        tasks={initialSnapshot.headlineTasks}
        date={initialSnapshot.headlinesDate ?? todayLocalISO()}
        currentMember={null}
        clients={clientNames}
        clientStages={clientStages}
      />
      <IdsSection items={weekIds} rocks={rocks} summaries={summaryIndex} />
      <ActionItemsSection items={weekActions} />
      {/* Same master pipeline the daily board edits, and in the same slot
          relative to the to-dos, so the section sits where the team expects. */}
      <SalesSection deals={salesDeals} />
      {/* Rocks moved to the end, collapsible per person; Innovation sits below it. */}
      <RocksTrackerSection rocks={rocks} quarter={QUARTER} summaries={summaryIndex} />
      <InnovationSection items={innovations} />
      {/* Forward-looking close: open to-dos + live rocks the team commits to for
          next week, read out just before rating the meeting. */}
      <NextWeekSection actionItems={actionItems} rocks={rocks} todayISO={todayLocalISO()} />
      <RatingSection ratings={ratings} date={ratingDate} />
    </div>
  );
}
