"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createIdsItem } from "@/lib/l10-actions";
import { L10_PRIORITIES } from "@/lib/l10";
import { OWNERS } from "@/lib/team";
import type { L10Priority, TeamMember } from "@/lib/database.types";

type Kind = "Client" | "Internal" | "Other";
const KINDS: Kind[] = ["Client", "Internal", "Other"];

// Lightweight public form (route /submit) so anyone can drop a topic/issue into
// the IDS queue without opening the board. The tag on the topic is one of:
//   • Client   — pick from the tracked client list
//   • Internal — the fixed "Internal" tag
//   • Other    — free text for anything else
// It writes an ids_items row via the same server action the board uses; the
// topic lands in the queue and can be upvoted.
export function TopicSubmitForm({ clients }: { clients: string[] }) {
  const [issue, setIssue] = useState("");
  const [owner, setOwner] = useState<TeamMember | "">("");
  const [priority, setPriority] = useState<L10Priority | "">("");
  const [kind, setKind] = useState<Kind>(clients.length > 0 ? "Client" : "Internal");
  const [clientName, setClientName] = useState(clients[0] ?? "");
  const [otherText, setOtherText] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // The client_internal tag(s) written for the chosen category.
  const tagsFor = (): string[] => {
    if (kind === "Client") return clientName ? [clientName] : [];
    if (kind === "Internal") return ["Internal"];
    const t = otherText.trim();
    return t ? [t] : [];
  };

  const canSubmit =
    issue.trim().length > 0 &&
    (kind !== "Client" || !!clientName) &&
    (kind !== "Other" || otherText.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      await createIdsItem({
        issue: issue.trim(),
        owner: owner || null,
        priority: priority || null,
        client_internal: tagsFor()
      });
      setIssue("");
      setOwner("");
      setPriority("");
      setOtherText("");
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

        <div className="mt-5 space-y-4">
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

          {/* Category: Client / Internal / Other */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">This is about…</label>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                    kind === k
                      ? "bg-accent text-text-inverse shadow-sm"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>

            {kind === "Client" && (
              <div className="mt-2">
                {clients.length > 0 ? (
                  <select
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text"
                    aria-label="Client"
                  >
                    {clients.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs italic text-text-muted">
                    No clients yet — add one on the weekly board, or use Internal / Other.
                  </p>
                )}
              </div>
            )}

            {kind === "Other" && (
              <div className="mt-2">
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Name it (e.g. a prospect, a tool, a project)…"
                  className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent/50 focus:outline-none"
                  aria-label="Other label"
                />
              </div>
            )}

            {kind === "Internal" && (
              <p className="mt-2 text-xs text-text-muted">Tagged as an internal topic.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending || !canSubmit}
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
