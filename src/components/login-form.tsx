"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attemptLogin } from "@/lib/auth-actions";

// Simple shared-password unlock for the internal boards. On success the server
// action sets the gate cookie and we navigate to `next` (kept same-site).
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const submit = () => {
    if (!password) return;
    setError(false);
    startTransition(async () => {
      const { ok } = await attemptLogin(password);
      if (ok) {
        router.replace(dest);
        router.refresh();
      } else {
        setError(true);
      }
    });
  };

  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-lg font-semibold tracking-tight text-text">
          Daily Sync Board
        </h1>
        <p className="mt-1 text-sm text-text-muted">Enter the team password to continue.</p>

        <div className="mt-5 space-y-3">
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Team password"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent/50 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">Incorrect password — try again.</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || !password}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-text-muted">
        Just here to add a meeting topic? No password needed —{" "}
        <a href="/submit" className="text-accent underline hover:no-underline">
          go to the submit form
        </a>
        .
      </p>
    </div>
  );
}
