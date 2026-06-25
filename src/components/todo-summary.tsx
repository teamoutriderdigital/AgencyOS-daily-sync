import { cn } from "@/lib/utils";
import { L10_PRIORITIES, getPriorityClasses, type ActionItem } from "@/lib/l10";
import { OWNERS } from "@/lib/team";

// At-a-glance summary of the team's to-dos: headline counts, plus open-item
// breakdowns by assignee and by urgency. Pure render from the action_items
// list, so it stays live alongside the dashboard's realtime subscription.
export function TodoSummary({ items, today }: { items: ActionItem[]; today: string }) {
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const dueToday = open.filter((i) => i.due_date === today);
  const overdue = open.filter((i) => i.due_date && i.due_date < today);

  const byOwner = OWNERS.map((owner) => ({
    owner,
    count: open.filter((i) => i.assignee === owner).length
  }));
  const unassigned = open.filter((i) => !i.assignee).length;

  const byPriority = L10_PRIORITIES.map((priority) => ({
    priority,
    count: open.filter((i) => i.priority === priority).length
  }));
  const noPriority = open.filter((i) => !i.priority).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={open.length} tone="accent" />
        <StatCard label="Due today" value={dueToday.length} tone="warn" />
        <StatCard label="Overdue" value={overdue.length} tone="danger" />
        <StatCard label="Completed" value={done.length} tone="ok" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Open by assignee">
          <div className="flex flex-wrap gap-2">
            {byOwner.map(({ owner, count }) => (
              <span
                key={owner}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-sm text-text"
              >
                {owner}
                <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-text-inverse">
                  {count}
                </span>
              </span>
            ))}
            {unassigned > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-sm text-text-muted">
                Unassigned
                <span className="rounded-full bg-text-muted px-1.5 text-xs font-semibold text-text-inverse">
                  {unassigned}
                </span>
              </span>
            )}
          </div>
        </Panel>

        <Panel title="Open by urgency">
          <div className="flex flex-wrap gap-2">
            {byPriority.map(({ priority, count }) => (
              <span
                key={priority}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
                  getPriorityClasses(priority)
                )}
              >
                {priority}
                <span className="rounded-full bg-text/10 px-1.5 text-xs font-semibold">{count}</span>
              </span>
            ))}
            {noPriority > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-3 py-1 text-sm text-text-muted">
                None
                <span className="rounded-full bg-text-muted px-1.5 text-xs font-semibold text-text-inverse">
                  {noPriority}
                </span>
              </span>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "accent" | "warn" | "danger" | "ok";
}) {
  const toneClasses: Record<typeof tone, string> = {
    accent: "text-accent",
    warn: "text-yellow-600",
    danger: "text-red-600",
    ok: "text-green-600"
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-semibold", toneClasses[tone])}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
      {children}
    </div>
  );
}
