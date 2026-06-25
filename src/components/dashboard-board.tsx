"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ActionItem } from "@/lib/l10";
import { ActionItemsSection } from "./action-items-section";
import { TodoSummary } from "./todo-summary";
import { DailySyncLauncher } from "./daily-sync-launcher";

// To-dos dashboard: live summary across the team plus the full add/manage list
// (the same ActionItemsSection used on the daily board, so edits behave
// identically). Subscribes to action_items so the summary updates in realtime.
export function DashboardBoard({
  initialItems,
  today
}: {
  initialItems: ActionItem[];
  today: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ActionItem[]>(initialItems);

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Overview of the team&apos;s work. Start a daily sync, or manage to-dos below.
        </p>
      </div>

      <DailySyncLauncher today={today} />

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-text">To-dos</h2>
        <TodoSummary items={items} today={today} />
        <ActionItemsSection items={items} />
      </div>
    </div>
  );
}
