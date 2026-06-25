"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ActionItem, IdsItem } from "@/lib/l10";
import type { DailyCheckin, DailyHeadline } from "@/lib/daily";
import { AGENDA_ORDER } from "@/lib/daily";
import type { DailySnapshot } from "@/lib/daily-server";
import type { TeamMember } from "@/lib/database.types";
import { OWNERS } from "@/lib/team";
import { ActionItemsSection } from "./action-items-section";
import { IdsSection } from "./ids-section";
import { DateHeader } from "./date-header";
import { CheckinSection } from "./checkin-section";
import { HeadlinesSection } from "./headlines-section";

const MEMBER_KEY = "daily-sync:member";

type Props = {
  initialSnapshot: DailySnapshot;
  today: string;
};

// The daily standup board. Check-ins and headlines are date-scoped (refetch +
// resubscribe when the day changes); to-dos and IDS are live master state. All
// four tables stream changes via Supabase realtime so two people in the board
// during the sync see each other's edits within ~2s.
export function DailyBoard({ initialSnapshot, today }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [date, setDate] = useState(initialSnapshot.date);
  const [currentMember, setCurrentMember] = useState<TeamMember | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>(initialSnapshot.checkins);
  const [headlines, setHeadlines] = useState<DailyHeadline[]>(initialSnapshot.headlines);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialSnapshot.actionItems);
  const [idsItems, setIdsItems] = useState<IdsItem[]>(initialSnapshot.idsItems);

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

  // ─── Live master tables (to-dos + IDS) — not date-scoped ──────────────────
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

    const idsChannel = supabase
      .channel("daily:ids_items")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ids_items" }, (payload) => {
        const row = payload.new as IdsItem;
        if (row.archived) return;
        setIdsItems((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ids_items" }, (payload) => {
        const row = payload.new as IdsItem;
        // Archiving == "Solved": drop it from the open list immediately.
        setIdsItems((prev) =>
          row.archived ? prev.filter((p) => p.id !== row.id) : prev.map((p) => (p.id === row.id ? row : p))
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ids_items" }, (payload) =>
        setIdsItems((prev) => prev.filter((p) => p.id !== (payload.old as { id: number }).id))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(actionChannel);
      supabase.removeChannel(idsChannel);
    };
  }, [supabase]);

  // ─── Date-scoped tables (check-ins + headlines) ───────────────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const [checkinsResp, headlinesResp] = await Promise.all([
        supabase.from("daily_checkins").select("*").eq("checkin_date", date),
        supabase
          .from("daily_headlines")
          .select("*")
          .eq("headline_date", date)
          .order("created_at", { ascending: true })
      ]);
      if (!active) return;
      if (!checkinsResp.error) setCheckins(checkinsResp.data ?? []);
      if (!headlinesResp.error) setHeadlines(headlinesResp.data ?? []);
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

    return () => {
      active = false;
      supabase.removeChannel(checkinChannel);
      supabase.removeChannel(headlineChannel);
    };
  }, [supabase, date]);

  // Render the four sections from the single AGENDA_ORDER constant (see daily.ts
  // — flipping IDS/to-dos order is a one-line change there).
  const sections: Record<(typeof AGENDA_ORDER)[number], React.ReactNode> = {
    checkin: <CheckinSection key="checkin" checkins={checkins} date={date} />,
    headlines: (
      <HeadlinesSection key="headlines" headlines={headlines} date={date} currentMember={currentMember} />
    ),
    ids: <IdsSection key="ids" items={idsItems} />,
    todos: <ActionItemsSection key="todos" items={actionItems} />
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
          Daily standup. Check-in and headlines are per-day; to-dos and IDS carry over until done.
        </p>
      </div>

      {AGENDA_ORDER.map((s) => sections[s])}
    </div>
  );
}
