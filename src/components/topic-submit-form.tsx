"use client";

import { useState, useTransition } from "react";
import { createIdsItem } from "@/lib/l10-actions";
import { L10_PRIORITIES } from "@/lib/l10";
import { OWNERS } from "@/lib/team";
import { CLIENTS } from "@/lib/daily";
import type { L10Priority, TeamMember } from "@/lib/database.types";

// Lightweight public form (route /submit) so anyone can drop a topic/issue into
// the IDS queue without opening the board. Writes an ids_items row via the same
// server action the board uses; it lands in the queue and can be upvoted.
export function TopicSubmitForm() {
  const [issue, setIssue] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [priority, setPriority] = useState<L10Priority | "">("");
  const [client, setClient] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const v = issue.trim();
    if (!v) return;
    const tags = client.trim() ? [client.trim()] : [];
    startTransition(async () => {
      await createIdsItem({
        issue: v,
        owner: owner || null,
        priority: priority || null,
        client_internal: tags
      });
      setIssue("");
      setOwner("");
      setPriority("");
      setClient("");
      setDone(true);
    });
  };

  return (
    <div className="mx-auto mt-10 max-w-lg px-4">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold tracking-tight text-text">Submit a topic</h1>
        <p className="mt-1 text-sm text-text-muted">
          Add an issue or agenda topic to the meeting queue. It shows up in IDS and can be upvoted.
        </p>

        {done && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Added to the queue. Submit another below, or close this tab.
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Topic / issue *</label>
            <textarea
              value={issue}
              onChange={(e) => {
                setIssue(e.target.value);
                if (done) setDone(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              rows={3}
              autoFocus
              placeholder="What should the team identify, discuss, or solve?"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Owner</label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value as TeamMember | "")}
                className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
              >
                <option value="">—</option>
                {OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as L10Priority | "")}
                className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
              >
                <option value="">—</option>
                {L10_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Client</label>
              <input
                type="text"
                list="submit-clients"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
              />
              <datalist id="submit-clients">
                {CLIENTS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending || !issue.trim()}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit topic"}
          </button>
          <p className="text-center text-xs text-text-muted">Tip: ⌘/Ctrl + Enter to submit.</p>
        </div>
      </div>
    </div>
  );
}
