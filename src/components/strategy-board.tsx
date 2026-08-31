"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import { OWNERS } from "@/lib/team";
import type { TeamMember } from "@/lib/database.types";
import {
  currentMonthISO,
  formatMonthLabel,
  shiftMonth,
  type StrategyActionItem,
  type StrategyMeeting
} from "@/lib/strategy";
import type { StrategySnapshot } from "@/lib/strategy-server";
import type { Client } from "@/lib/clients";
import {
  createStrategyAction,
  deleteStrategyAction,
  saveStrategyNotes,
  updateStrategyAction
} from "@/lib/strategy-actions";
import { addClient, updateClient } from "@/lib/client-actions";
import { SectionShell } from "./section-shell";

type Props = {
  initialSnapshot: StrategySnapshot;
  currentMonth: string;
  clients: Client[];
};

// The monthly client strategy board: one card per client per month, each with
// free-text meeting notes and its own action items. Month-scoped the way the
// daily board is date-scoped (refetch + resubscribe when the month changes),
// and streamed via realtime like every other section.
export function StrategyBoard({ initialSnapshot, currentMonth, clients }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [month, setMonth] = useState(initialSnapshot.month);
  const [meetings, setMeetings] = useState<StrategyMeeting[]>(initialSnapshot.meetings);
  const [actions, setActions] = useState<StrategyActionItem[]>(initialSnapshot.actions);

  // ─── Month-scoped fetch + realtime, mirroring the daily board ─────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const [meetingsResp, actionsResp] = await Promise.all([
        supabase.from("strategy_meetings").select("*").eq("month", month),
        supabase
          .from("strategy_actions")
          .select("*")
          .eq("month", month)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      ]);
      if (!active) return;
      if (!meetingsResp.error) setMeetings(meetingsResp.data ?? []);
      if (!actionsResp.error) setActions(actionsResp.data ?? []);
    })();

    const meetingChannel = supabase
      .channel(`strategy:meetings:${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_meetings" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setMeetings((prev) => prev.filter((m) => m.id !== oldId));
          return;
        }
        const row = payload.new as StrategyMeeting;
        if (row.month !== month) return;
        setMeetings((prev) => {
          const idx = prev.findIndex((m) => m.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    const actionChannel = supabase
      .channel(`strategy:actions:${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_actions" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id: number }).id;
          setActions((prev) => prev.filter((a) => a.id !== oldId));
          return;
        }
        const row = payload.new as StrategyActionItem;
        if (row.month !== month) return;
        setActions((prev) => {
          const idx = prev.findIndex((a) => a.id === row.id);
          if (idx === -1) return [...prev, row];
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(meetingChannel);
      supabase.removeChannel(actionChannel);
    };
  }, [supabase, month]);

  // Roster split: archived clients hide from the card list but stay restorable
  // from the strip at the bottom. Cards also include any client that has a
  // meeting or action this month but is off the roster entirely (churned or
  // deleted), so history stays visible.
  const activeClients = useMemo(() => clients.filter((c) => !c.strategy_archived), [clients]);
  const archivedClients = useMemo(() => clients.filter((c) => c.strategy_archived), [clients]);

  const cardClients = useMemo(() => {
    const byName = new Map<string, Client | null>();
    for (const c of activeClients) byName.set(c.name, c);
    const rosterNames = new Set(clients.map((c) => c.name));
    for (const m of meetings) if (!rosterNames.has(m.client)) byName.set(m.client, null);
    for (const a of actions) if (!rosterNames.has(a.client)) byName.set(a.client, null);
    return [...byName.entries()];
  }, [clients, activeClients, meetings, actions]);

  const isCurrentMonth = month === currentMonth;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-muted hover:bg-surface-alt hover:text-text"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-muted hover:bg-surface-alt hover:text-text"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-text">
            {formatMonthLabel(month)}
          </h1>

          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => {
              if (e.target.value) setMonth(`${e.target.value}-01`);
            }}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
          />

          {!isCurrentMonth && (
            <>
              <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                Viewing another month
              </span>
              <button
                type="button"
                onClick={() => setMonth(currentMonth)}
                className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline"
              >
                Back to this month
              </button>
            </>
          )}

          <div className="ml-auto">
            <AddClientControl />
          </div>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Client strategy meetings — one per client per month. Capture the meeting notes and the
          action items agreed with each client.
        </p>
      </div>

      {cardClients.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface px-5 py-8 text-center text-sm italic text-text-muted">
          No clients yet. Add clients on the weekly board&apos;s client tracker and they&apos;ll
          appear here.
        </p>
      )}

      {cardClients.map(([name, row]) => (
        <ClientStrategyCard
          key={`${month}:${name}`}
          client={name}
          clientRow={row}
          month={month}
          meeting={meetings.find((m) => m.client === name)}
          actions={actions.filter((a) => a.client === name)}
        />
      ))}

      {archivedClients.length > 0 && <ArchivedStrip clients={archivedClients} />}
    </div>
  );
}

// Inline "+ Add client" control in the page header. Saves into the shared
// clients table, so the new client also appears on the weekly stage tracker
// and the /submit picker (stage starts at Onboarding).
function AddClientControl() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = name.trim();
    if (!v) return;
    startTransition(async () => {
      await addClient({ name: v });
      setName("");
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-strong"
      >
        + Add client
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setOpen(false);
        }}
        autoFocus
        placeholder="Client name"
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || !name.trim()}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-text-muted hover:text-text"
      >
        Cancel
      </button>
    </div>
  );
}

// Archived clients: hidden from the card list but one click from coming back.
function ArchivedStrip({ clients }: { clients: Client[] }) {
  const [, startTransition] = useTransition();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-alt/30 px-5 py-3">
      <span className="mr-3 text-xs font-medium text-text-muted">
        Archived ({clients.length})
      </span>
      <span className="inline-flex flex-wrap gap-2 align-middle">
        {clients.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-text-muted"
          >
            {c.name}
            <button
              type="button"
              onClick={() =>
                startTransition(() => updateClient(c.id, { strategy_archived: false }))
              }
              className="font-medium text-accent hover:underline"
              title="Bring this client back onto the strategy board"
            >
              ↩ Restore
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}

// One client's meeting for the month. The card renders whether or not a
// meeting row exists yet — the row is created lazily by the first notes save
// or action added (see strategy-actions.ts).
function ClientStrategyCard({
  client,
  clientRow,
  month,
  meeting,
  actions
}: {
  client: string;
  // Null when the client has meeting data this month but is off the roster
  // (churned/deleted) — those cards are history-only and can't be archived.
  clientRow: Client | null;
  month: string;
  meeting: StrategyMeeting | undefined;
  actions: StrategyActionItem[];
}) {
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const openCount = actions.filter((a) => !a.done).length;

  return (
    <SectionShell
      title={client}
      count={openCount}
      countLabel="open actions"
      rightSlot={
        <div className="flex items-center gap-2">
          {clientRow && (
            <button
              type="button"
              onClick={() =>
                startTransition(() => updateClient(clientRow.id, { strategy_archived: true }))
              }
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-muted hover:border-accent/50 hover:text-accent"
              title="Hide this client from the strategy board (notes and actions are kept; restore from the Archived strip below)"
            >
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong"
          >
            + Action
          </button>
        </div>
      }
    >
      <div className="space-y-1 px-5 py-3">
        <label className="text-xs font-medium text-text-muted">Meeting notes</label>
        <textarea
          key={meeting?.id ?? "new"}
          defaultValue={meeting?.notes ?? ""}
          rows={3}
          placeholder="What was discussed, decisions made, strategy for the month ahead…"
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (meeting?.notes ?? "")) {
              startTransition(() => saveStrategyNotes(client, month, v));
            }
          }}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-accent/50 focus:outline-none"
        />
      </div>

      <div className="divide-y divide-border/50 border-t border-border/50">
        {actions.length === 0 && !adding && (
          <p className="px-5 py-4 text-center text-xs italic text-text-muted">
            No action items yet.
          </p>
        )}
        {actions.map((action) => (
          <StrategyActionRow key={action.id} action={action} />
        ))}
        {adding && (
          <NewActionRow
            client={client}
            month={month}
            onCancel={() => setAdding(false)}
            onSaved={() => setAdding(false)}
          />
        )}
      </div>
    </SectionShell>
  );
}

function StrategyActionRow({ action }: { action: StrategyActionItem }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <input
        type="checkbox"
        checked={action.done}
        onChange={(e) => startTransition(() => updateStrategyAction(action.id, { done: e.target.checked }))}
        title="Done"
      />
      <input
        type="text"
        defaultValue={action.text}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== action.text) startTransition(() => updateStrategyAction(action.id, { text: v }));
        }}
        placeholder="Action item"
        className={cn(
          "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-accent/50 focus:outline-none",
          action.done ? "text-text-muted line-through" : "text-text"
        )}
      />
      <select
        value={action.owner ?? ""}
        onChange={(e) =>
          startTransition(() =>
            updateStrategyAction(action.id, { owner: (e.target.value as TeamMember) || null })
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
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this action item?")) startTransition(() => deleteStrategyAction(action.id));
        }}
        className="text-xs text-text-muted hover:text-red-600"
      >
        ✕
      </button>
    </div>
  );
}

function NewActionRow({
  client,
  month,
  onCancel,
  onSaved
}: {
  client: string;
  month: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = text.trim();
    if (!v) return;
    startTransition(async () => {
      await createStrategyAction(client, month, { text: v, owner: owner || null });
      onSaved();
    });
  };

  return (
    <div className="flex items-center gap-3 bg-surface-alt/30 px-5 py-2.5">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder="What did we agree to do?"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
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
      <button
        type="button"
        onClick={save}
        disabled={pending || !text.trim()}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
      >
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-text-muted hover:text-text">
        Cancel
      </button>
    </div>
  );
}
