"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { CLIENT_STAGES, clientStageClasses, type Client } from "@/lib/clients";
import { ROCK_OWNERS } from "@/lib/rocks";
import { addClient, deleteClient, setClientStage, updateClient } from "@/lib/client-actions";
import type { ClientStage } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

// Weekly client lifecycle review: one row per client with a stage dropdown the
// team sets at the L10. Header summarizes how many sit in each stage, with
// "At Risk" surfaced first because that's what needs attention.
export function ClientStagesSection({ clients }: { clients: Client[] }) {
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<ClientStage, number>();
    for (const c of clients) map.set(c.stage, (map.get(c.stage) ?? 0) + 1);
    return map;
  }, [clients]);

  const atRisk = counts.get("At Risk") ?? 0;
  const active = counts.get("Active") ?? 0;

  return (
    <SectionShell
      title="Client Stages"
      count={clients.length}
      countLabel="clients"
      rightSlot={
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-text-muted sm:inline">
            {active} Active
            {atRisk > 0 && <span className="ml-1 font-semibold text-red-600">· {atRisk} At Risk</span>}
          </span>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong"
          >
            + Add client
          </button>
        </div>
      }
    >
      <div className="divide-y divide-border/50">
        {clients.length === 0 && !adding && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No clients yet. Add one to start tracking stages.
          </p>
        )}
        {clients.map((client) => (
          <ClientRow key={client.id} client={client} />
        ))}
        {adding && <NewClientRow onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />}
      </div>
    </SectionShell>
  );
}

function ClientRow({ client }: { client: Client }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <input
        type="text"
        defaultValue={client.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== client.name) startTransition(() => updateClient(client.id, { name: v }));
        }}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-text hover:border-border focus:border-accent/50 focus:outline-none"
        title="Client name"
      />
      <select
        value={client.owner ?? ""}
        onChange={(e) =>
          startTransition(() => updateClient(client.id, { owner: e.target.value || null }))
        }
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted"
        title="Owner"
      >
        <option value="">— owner —</option>
        {ROCK_OWNERS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select
        value={client.stage}
        onChange={(e) =>
          startTransition(() => setClientStage(client.id, e.target.value as ClientStage))
        }
        className={cn(
          "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold",
          clientStageClasses(client.stage)
        )}
        title="Stage"
      >
        {CLIENT_STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Remove client "${client.name}"?`)) {
            startTransition(() => deleteClient(client.id));
          }
        }}
        className="text-xs text-text-muted hover:text-red-600"
        title="Remove client"
      >
        ✕
      </button>
    </div>
  );
}

function NewClientRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    const v = name.trim();
    if (!v) return;
    startTransition(async () => {
      await addClient({ name: v });
      onSaved();
    });
  };

  return (
    <div className="flex items-center gap-2 bg-surface-alt/30 px-5 py-2.5">
      <input
        type="text"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Client name…"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
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
  );
}
