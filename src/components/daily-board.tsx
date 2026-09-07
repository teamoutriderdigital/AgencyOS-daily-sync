"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ActionItem } from "@/lib/l10";
import type { DailyCheckin, DailyHeadline, DailyReviewItem, HeadlineTask } from "@/lib/daily";
import { AGENDA_ORDER } from "@/lib/daily";
import type { DailySnapshot } from "@/lib/daily-server";
import type { TeamMember } from "@/lib/database.types";
import type { SalesDeal } from "@/lib/sales";
import type { OpsTask } from "@/lib/ops";
import { OWNERS } from "@/lib/team";
import { ActionItemsSection } from "./action-items-section";
import { ReviewSection } from "./review-section";
import { DateHeader } from "./date-header";
import { CheckinSection } from "./checkin-section";
import { SubprojectsSection } from "./subprojects-section";
import { HeadlinesSection } from "./headlines-section";
import { SalesSection } from "./sales-section";
import { OpsSection } from "./ops-section";

const MEMBER_KEY = "daily-sync:member";

type Props = {
  initialSnapshot: DailySnapshot;
  today: string;
  knownClients: string[];
};

// The daily standup board. Check-ins and headlines are date-scoped (refetch +
// resubscribe when the day changes); to-dos and IDS are live master state. All
// four tables stream changes via Supabase realtime so two people in the board
// during the sync see each other's edits within ~2s.
export function DailyBoard({ initialSnapshot, today, knownClients }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [date, setDate] = useState(initialSnapshot.date);
  const [currentMember, setCurrentMember] = useState<TeamMember | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>(initialSnapshot.checkins);
  const [headlines, setHeadlines] = useState<DailyHeadline[]>(initialSnapshot.headlines);
  const [headlineTasks, setHeadlineTasks] = useState<HeadlineTask[]>(initialSnapshot.headlineTasks);
  const [reviewItems, setReviewItems] = useState<DailyReviewItem[]>(initialSnapshot.reviewItems);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialSnapshot.actionItems);
  const [salesDeals, setSalesDeals] = useState<SalesDeal[]>(initialSnapshot.salesDeals);
  const [opsTasks, setOpsTasks] = useState<OpsTask[]>(initialSnapshot.opsTasks);

  // Remember "who am I" across sessions (stands in for auth).
  useEffect(() => {
    const saved = window.localStorage.getItem(MEMBER_KEY);
    if (saved && (OWNERS as string[]).includes(saved)) setCurrentMember(saved as TeamMember);
  }, []);
  const onMemberChange = (member: TeamMember | null) => {
    setCurrentMember(member);
    if (member) window.localStorage.setItem(MEMBER_KEY, member);
    else window.localStorage.removeItem(MEMBER_KEY);
  };

  // ─── Live master table (to-dos) — not date-scoped ─────────────────────────
  useEffect(() => {
    const actionChannel = supabase
      .channel("daily:action_items")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_items" }, (payload) =>
        setActionItems((prev) =>
          prev.some((p) => p.id === (payload.new as ActionItem).id)
            ? prev
            : [...prev, payload.new as ActionItem]
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

    const salesChannel = supabase
      .channel("daily:sales_deals")
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

    const opsChannel = supabase
      .channel("daily:ops_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "ops_tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setOpsTasks((prev) => prev.filter((t) => t.id !== oldId));
          return;
        }
        const row = payload.new as OpsTask;
        setOpsTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(actionChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(opsChannel);
    };
  }, [supabase]);

  // ─── Date-scoped tables (check-ins + headlines) ───────────────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const [checkinsResp, headlinesResp, headlineTasksResp, reviewResp] = await Promise.all([
        supabase.from("daily_checkins").select("*").eq("checkin_date", date),
        supabase
          .from("daily_headlines")
          .select("*")
          .eq("headline_date", date)
          .order("created_at", { ascending: true }),
        supabase
          .from("headline_tasks")
          .select("*")
          .eq("headline_date", date)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("daily_review_items")
          .select("*")
          .eq("review_date", date)
          .order("done", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      ]);
      if (!active) return;
      if (!checkinsResp.error) setCheckins(checkinsResp.data ?? []);
      if (!headlinesResp.error) setHeadlines(headlinesResp.data ?? []);
      if (!headlineTasksResp.error) setHeadlineTasks(headlineTasksResp.data ?? []);
      if (!reviewResp.error) setReviewItems(reviewResp.data ?? []);
    })();

    const checkinChannel = supabase
      .channel(`daily:checkins:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setCheckins((prev) => prev.filter((c) => c.id !== oldId));
          return;
        }
        const row = payload.new as DailyCheckin;
        if (row.checkin_date !== date) return;
        setCheckins((prev) => {
          const idx = prev.findIndex((c) => c.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    const headlineChannel = supabase
      .channel(`daily:headlines:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_headlines" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setHeadlines((prev) => prev.filter((h) => h.id !== oldId));
          return;
        }
        const row = payload.new as DailyHeadline;
        if (row.headline_date !== date) return;
        setHeadlines((prev) => {
          const idx = prev.findIndex((h) => h.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    const headlineTaskChannel = supabase
      .channel(`daily:headline_tasks:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "headline_tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setHeadlineTasks((prev) => prev.filter((t) => t.id !== oldId));
          return;
        }
        const row = payload.new as HeadlineTask;
        if (row.headline_date !== date) return;
        setHeadlineTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    const reviewChannel = supabase
      .channel(`daily:review:${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_review_items" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setReviewItems((prev) => prev.filter((r) => r.id !== oldId));
          return;
        }
        const row = payload.new as DailyReviewItem;
        if (row.review_date !== date) return;
        setReviewItems((prev) => {
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
      supabase.removeChannel(checkinChannel);
      supabase.removeChannel(headlineChannel);
      supabase.removeChannel(headlineTaskChannel);
      supabase.removeChannel(reviewChannel);
    };
  }, [supabase, date]);

  // Known clients = all-time list from the server, plus any clients on the
  // currently loaded headlines (so a just-added one shows as a chip live).
  const clientOptions = useMemo(() => {
    const set = new Set<string>(knownClients);
    for (const h of headlines) if (h.client) set.add(h.client);
    return [...set];
  }, [knownClients, headlines]);

  // Render the daily sections from the single AGENDA_ORDER constant (see
  // daily.ts). IDS lives on the weekly board, not here.
  const sections: Record<(typeof AGENDA_ORDER)[number], React.ReactNode> = {
    checkin: <CheckinSection key="checkin" checkins={checkins} date={date} />,
    headlines: (
      <div key="client-work" className="space-y-4">
        {date === today && <SubprojectsSection />}
        <details open={date !== today}>
          <summary className="mb-3 cursor-pointer text-sm text-text-muted">Daily meeting notes and task checklist</summary>
          <HeadlinesSection
            key="headlines"
            headlines={headlines}
            tasks={headlineTasks}
            date={date}
            currentMember={currentMember}
            clients={clientOptions}
          />
        </details>
      </div>
    ),
    review: (
      <ReviewSection key="review" items={reviewItems} date={date} currentMember={currentMember} />
    ),
    todos: <ActionItemsSection key="todos" items={actionItems} />,
    sales: <SalesSection key="sales" deals={salesDeals} />,
    ops: <OpsSection key="ops" tasks={opsTasks} />
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <DateHeader
          date={date}
          today={today}
          onSelect={setDate}
          currentMember={currentMember}
          onMemberChange={onMemberChange}
        />
        <p className="mt-1 text-sm text-text-muted">
          Daily standup. Check-in, headlines, and items to review are per-day; to-dos carry over
          until done. (IDS lives on the weekly board.)
        </p>
      </div>

      {AGENDA_ORDER.map((s) => sections[s])}
    </div>
  );
}
