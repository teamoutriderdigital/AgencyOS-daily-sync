"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { createInnovation, deleteInnovation, updateInnovation } from "@/lib/innovations-actions";
import type { Innovation } from "@/lib/innovations";
import type { Department } from "@/lib/database.types";
import { DEPARTMENTS, getDepartmentClasses } from "@/lib/department";
import { SectionShell } from "./section-shell";

// Ideas worth stealing or building on — surfaced by anyone, any time. Each row
// is a title with an optional link, who found it, a note, and a department tag.
// The add form is always visible at the top, matching the headlines section.
export function InnovationSection({ items }: { items: Innovation[] }) {
  return (
    <SectionShell title="Innovation" count={items.length} countLabel="ideas">
      <AddInnovationForm />
      <div className="divide-y divide-border/50">
        {items.length === 0 && (
          <p className="px-5 py-6 text-center text-xs italic text-text-muted">
            No innovations logged yet. Found something worth sharing? Add it above.
          </p>
        )}
        {items.map((item) => (
          <InnovationRow key={item.id} item={item} />
        ))}
      </div>
    </SectionShell>
  );
}

function DepartmentSelect({
  value,
  onChange
}: {
  value: Department | null;
  onChange: (v: Department | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value as Department) || null)}
      className="flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted"
      title="Department"
    >
      <option value="">—</option>
      {DEPARTMENTS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}

// Persistent add bar — always on screen; saving clears and keeps it ready.
function AddInnovationForm() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [foundBy, setFoundBy] = useState("");
  const [note, setNote] = useState("");
  const [department, setDepartment] = useState<Department | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createInnovation({
        title: t,
        url: url.trim() || null,
        found_by: foundBy.trim() || null,
        note: note.trim() || null,
        department
      });
      setTitle("");
      setUrl("");
      setFoundBy("");
      setNote("");
      setDepartment(null);
    });
  };

  return (
    <div className="space-y-2 border-b border-border bg-surface-alt/30 px-5 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
          placeholder="What's the idea?"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (optional)"
          className="w-40 flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        />
        <input
          type="text"
          value={foundBy}
          onChange={(e) => setFoundBy(e.target.value)}
          placeholder="Found by"
          className="w-28 flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        />
        <DepartmentSelect value={department} onChange={setDepartment} />
        <button
          type="button"
          onClick={save}
          disabled={pending || !title.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
        >
          + Add
        </button>
      </div>
      <textarea
        value={note}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)…"
        className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
    </div>
  );
}

function InnovationRow({ item }: { item: Innovation }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? "");
  const [foundBy, setFoundBy] = useState(item.found_by ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [department, setDepartment] = useState<Department | null>(item.department);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await updateInnovation(item.id, {
        title: t,
        url: url.trim() || null,
        found_by: foundBy.trim() || null,
        note: note.trim() || null,
        department
      });
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="space-y-2 bg-surface-alt/30 px-5 py-3">
        <div className="flex flex-wrap items-start gap-2">
          <input
            type="text"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            className="w-40 flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
          />
          <input
            type="text"
            value={foundBy}
            onChange={(e) => setFoundBy(e.target.value)}
            placeholder="Found by"
            className="w-28 flex-shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
          />
          <DepartmentSelect value={department} onChange={setDepartment} />
        </div>
        <textarea
          value={note}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)…"
          className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !title.trim()}
            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm font-semibold text-text">{item.title}</p>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              link ↗
            </a>
          )}
          <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-semibold", getDepartmentClasses(item.department))}>
            {item.department ?? "Unassigned"}
          </span>
        </div>
        {item.found_by && <p className="text-xs text-text-muted">Found by {item.found_by}</p>}
        {item.note && <p className="text-xs text-text-muted">{item.note}</p>}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-0.5 flex-shrink-0 text-xs text-text-muted hover:text-accent"
        title="Edit"
      >
        ✏️
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this innovation?")) {
            startTransition(() => deleteInnovation(item.id));
          }
        }}
        className={cn("mt-0.5 flex-shrink-0 text-xs text-text-muted hover:text-red-600", pending && "opacity-50")}
        title="Delete"
      >
        🗑️
      </button>
    </div>
  );
}
