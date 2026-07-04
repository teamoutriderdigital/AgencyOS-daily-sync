"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ROCK_OWNERS, ROCK_TYPES, SEED_ROCKS, rockToLine, type Rock } from "@/lib/rocks";
import type { RockType } from "@/lib/database.types";
import { createRock, deleteRock, seedRocks, updateRock } from "@/lib/rocks-actions";
import { SectionShell } from "./section-shell";

export function RocksTable({ rocks }: { rocks: Rock[] }) {
  const [, startTransition] = useTransition();
  const [copied, setCopied] = useState("");

  const addRock = () =>
    startTransition(() =>
      createRock({ sort_order: rocks.length ? Math.max(...rocks.map((r) => r.sort_order)) + 1 : 0 })
    );

  const copyAll = () => {
    const text = rocks.map(rockToLine).join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(`Copied ${rocks.length} rocks ✓`);
          setTimeout(() => setCopied(""), 2600);
        },
        () => setCopied("Copy failed")
      );
    } else {
      setCopied("Clipboard unavailable");
    }
  };

  return (
    <SectionShell
      title="Finalized rocks → Master Dashboard"
      count={rocks.length}
      countLabel="rocks"
      rightSlot={
        <div className="flex items-center gap-2">
          {copied && <span className="text-xs text-text-muted">{copied}</span>}
          <button
            type="button"
            onClick={copyAll}
            className="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-text hover:border-text"
          >
            Copy as text
          </button>
          <button
            type="button"
            onClick={addRock}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong"
          >
            + Add rock
          </button>
        </div>
      }
    >
      {rocks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
          <p className="text-sm text-text-muted">
            No rocks yet. Load the 19 drafts from yesterday&apos;s brain-dump, then refine each “done” sentence
            and deadline live.
          </p>
          <button
            type="button"
            onClick={() => startTransition(() => seedRocks(SEED_ROCKS))}
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-text-inverse hover:bg-accent-strong"
          >
            Insert 19 draft rocks
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt text-left">
                <Th className="w-[24%]">Rock</Th>
                <Th className="w-[11%]">Owner</Th>
                <Th className="w-[10%]">Type</Th>
                <Th className="w-[38%]">“Done” — one sentence (SMART)</Th>
                <Th className="w-[13%]">Deadline</Th>
                <Th className="w-[34px]"> </Th>
              </tr>
            </thead>
            <tbody>
              {rocks.map((rock) => (
                <RockRow key={rock.id} rock={rock} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

function RockRow({ rock }: { rock: Rock }) {
  const [, startTransition] = useTransition();
  const patch = (input: Parameters<typeof updateRock>[1]) =>
    startTransition(() => updateRock(rock.id, input));

  const ownerOptions = Array.from(new Set([...ROCK_OWNERS, rock.owner].filter(Boolean) as string[]));

  return (
    <tr className="border-b border-border/50 align-top">
      <td className="px-1.5 py-1">
        <AutoTextarea
          defaultValue={rock.title}
          placeholder="Rock title"
          onCommit={(v) => v !== rock.title && patch({ title: v })}
        />
      </td>
      <td className="px-1.5 py-1">
        <select
          value={rock.owner ?? ""}
          onChange={(e) => patch({ owner: e.target.value || null })}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-accent hover:border-border focus:border-accent focus:outline-none"
          title="Owner"
        >
          <option value="">—</option>
          {ownerOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1.5 py-1">
        <select
          value={rock.rock_type}
          onChange={(e) => patch({ rock_type: e.target.value as RockType })}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-text-muted hover:border-border focus:border-accent focus:outline-none"
          title="Type"
        >
          {ROCK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1.5 py-1">
        <AutoTextarea
          defaultValue={rock.smart ?? ""}
          placeholder="One sentence: what does done look like?"
          onCommit={(v) => v !== (rock.smart ?? "") && patch({ smart: v || null })}
        />
      </td>
      <td className="px-1.5 py-1">
        <input
          type="date"
          defaultValue={rock.deadline ?? ""}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== (rock.deadline ?? null)) patch({ deadline: v });
          }}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-text hover:border-border focus:border-accent focus:outline-none"
          title="Deadline"
        />
      </td>
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete rock "${rock.title || "untitled"}"?`)) {
              startTransition(() => deleteRock(rock.id));
            }
          }}
          className="rounded p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600"
          aria-label="Delete rock"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// Uncontrolled, auto-growing textarea. Uncontrolled so a realtime re-render of a
// sibling row never clobbers text mid-edit; commits on blur.
function AutoTextarea({
  defaultValue,
  placeholder,
  onCommit
}: {
  defaultValue: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <textarea
      rows={1}
      defaultValue={defaultValue}
      placeholder={placeholder}
      ref={(el) => {
        if (el) grow(el);
      }}
      onInput={(e) => grow(e.currentTarget)}
      onBlur={(e) => onCommit(e.target.value.trim())}
      className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm leading-snug text-text hover:border-border focus:border-accent focus:bg-surface focus:outline-none"
    />
  );
}
