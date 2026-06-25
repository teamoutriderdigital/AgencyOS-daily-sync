"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ActionItem } from "@/lib/l10";
import type { DailyHeadline } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";
import { OWNERS } from "@/lib/team";
import { ActionItemsSection } from "./action-items-section";
import { TodoSummary } from "./todo-summary";
import { DailySyncLauncher } from "./daily-sync-launcher";
import { HeadlinesSection } from "./headlines-section";

const MEMBER_KEY = "daily-sync:member";

// To-dos dashboard + today's client headlines. Live summary across the team
// plus the full add/manage list (same ActionItemsSection used on the daily
// board) and today's headlines (same HeadlinesSection). Subscribes to
// action_items and today's daily_headlines so both stay in realtime.
export function DashboardBoard({
  initialItems,
  initialHeadlines,
  today
}: {
  initialItems: ActionItem[];
  initialHeadlines: DailyHeadline[];
  today: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ActionItem[]>(initialItems);
  const [headlines, setHeadlines] = useState<DailyHeadline[]>(initialHeadlines);
  const [member, setMember] = useState<TeamMember | null>(null);

  // "Who am I" for headline authorship (shared with the daily board's selector).
  useEffect(() => {
    const saved = window.localStorage.getItem(MEMBER_KEY);
    if (saved && (OWNERS as string[]).includes(saved)) setMember(saved as TeamMember);
  }, []);

  // Live to-dos.
  useEffect(() => {
    const channel = supabase
      .channel("dashboard:action_items")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "action_items" }, (payload) =>
        setItems((prev) =>
          prev.some((p) => p.id === (payload.new as ActionItem).id)
            ? prev
            : [...prev, payload.new as ActionItem]
        )
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "action_items" }, (payload) =>
        setItems((prev) =>
          prev.map((p) => (p.id === (payload.new as ActionItem).id ? (payload.new as ActionItem) : p))
        )
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "action_items" }, (payload) =>
        setItems((prev) => prev.filter((p) => p.id !== (payload.old as { id: number }).id))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Live today's headlines.
  useEffect(() => {
    const channel = supabase
      .channel("dashboard:daily_headlines")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_headlines" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setHeadlines((prev) => prev.filter((h) => h.id !== oldId));
          return;
        }
        const row = payload.new as DailyHeadline;
        if (row.headline_date !== today) return;
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
      supabase.removeChannel(channel);
    };
  }, [supabase, today]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Overview of the team&apos;s work. Start a daily sync, post client headlines, or manage
          to-dos.
        </p>
      </div>

      <DailySyncLauncher today={today} />

      <HeadlinesSection headlines={headlines} date={today} currentMember={member} />

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-text">To-dos</h2>
        <TodoSummary items={items} today={today} />
        <ActionItemsSection items={items} />
      </div>
    </div>
  );
}
