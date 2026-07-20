"use client";

import { useState, useTransition } from "react";
import { resetAndSeedRocks } from "@/lib/rocks-actions";
import { reconcileIds, type ReconcilePlan } from "@/lib/l10-actions";

// Operator-only controls for two live-data maintenance actions. Both are
// destructive-ish (delete + re-insert), so neither can be applied cold: a dry
// run must be previewed first, Apply requires an explicit window.confirm, and
// the preview resets after a successful apply so a stray click can't
// double-apply the same plan.

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="font-display text-base font-semibold tracking-tight text-text">{title}</h2>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function PreviewButton({
  onClick,
  disabled,
  pending
}: {
  onClick: () => void;
  disabled?: boolean;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-alt hover:text-text disabled:opacity-50"
    >
      {pending ? "Previewing…" : "Preview (dry run)"}
    </button>
  );
}

function ApplyButton({
  onClick,
  disabled,
  pending
}: {
  onClick: () => void;
  disabled?: boolean;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
      title={disabled ? "Run a preview first" : undefined}
    >
      {pending ? "Applying…" : "Apply"}
    </button>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}

// ─── Re-seed rocks ────────────────────────────────────────────────────────

function RocksCard() {
  const [preview, setPreview] = useState<{ willDelete: number; willInsert: number } | null>(null);
  const [applied, setApplied] = useState<{ willDelete: number; willInsert: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runPreview = () => {
    setError(null);
    setApplied(null);
    startTransition(async () => {
      try {
        const plan = await resetAndSeedRocks(true);
        setPreview(plan);
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  };

  const runApply = () => {
    if (!preview) return;
    const ok = window.confirm(
      `This will delete ${preview.willDelete} current-quarter rocks and insert ${preview.willInsert} new ones. This cannot be undone. Continue?`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await resetAndSeedRocks(false);
        setApplied(result);
        setPreview(null);
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  };

  return (
    <Card title="Re-seed rocks (Q3 2026)" description="Deletes the current-quarter rocks and re-seeds the 22-row Q3 2026 list.">
      <ButtonRow>
        <PreviewButton onClick={runPreview} pending={pending} />
        <ApplyButton onClick={runApply} disabled={!preview} pending={pending} />
      </ButtonRow>
      {preview && (
        <p className="text-sm text-text">
          Will delete {preview.willDelete} current-quarter rocks and insert {preview.willInsert}.
        </p>
      )}
      {applied && (
        <p className="text-sm font-medium text-green-700">
          Applied — deleted {applied.willDelete} current-quarter rocks and inserted {applied.willInsert}.
        </p>
      )}
      <ErrorNote message={error} />
    </Card>
  );
}

// ─── Reconcile IDS ──────────────────────────────────────────────────────────

function ReconcilePlanView({ plan }: { plan: ReconcilePlan }) {
  return (
    <div className="space-y-2 text-sm text-text">
      <div>
        <p>Will archive {plan.toArchive.length} issues:</p>
        {plan.toArchive.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-text-muted">
            {plan.toArchive.map((i) => (
              <li key={i.id}>{i.issue}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p>Will insert {plan.toInsert.length}:</p>
        {plan.toInsert.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-text-muted">
            {plan.toInsert.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-text-muted">unchanged: {plan.unchanged}.</p>
    </div>
  );
}

function IdsCard() {
  const [preview, setPreview] = useState<ReconcilePlan | null>(null);
  const [applied, setApplied] = useState<ReconcilePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runPreview = () => {
    setError(null);
    setApplied(null);
    startTransition(async () => {
      try {
        const plan = await reconcileIds(true);
        setPreview(plan);
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  };

  const runApply = () => {
    if (!preview) return;
    const ok = window.confirm(
      `This will archive ${preview.toArchive.length} open IDS issue(s) and insert ${preview.toInsert.length} canonical issue(s). Continue?`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await reconcileIds(false);
        setApplied(result);
        setPreview(null);
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  };

  return (
    <Card title="Reconcile IDS" description="Archives open IDS issues not in the canonical set and inserts missing canonical ones.">
      <ButtonRow>
        <PreviewButton onClick={runPreview} pending={pending} />
        <ApplyButton onClick={runApply} disabled={!preview} pending={pending} />
      </ButtonRow>
      {preview && <ReconcilePlanView plan={preview} />}
      {applied && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-green-700">Applied.</p>
          <ReconcilePlanView plan={applied} />
        </div>
      )}
      <ErrorNote message={error} />
    </Card>
  );
}

export function AdminPanel() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">
        Live-data maintenance. Always preview a dry run before applying — Apply is disabled until a
        preview has been run.
      </p>
      <RocksCard />
      <IdsCard />
    </div>
  );
}
