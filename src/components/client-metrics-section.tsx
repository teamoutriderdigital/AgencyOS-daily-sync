"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Fragment } from "react";
import {
  METRIC_COLUMNS,
  clientTrend,
  deltaLabel,
  deltaTone,
  fmtMetric,
  latestPerClient,
  num,
  orderRows,
  splitConnected,
  throughNotes,
  weekLabel,
  type ClientMetric,
  type DeltaTone,
} from "@/lib/client-metrics";
import { SectionShell } from "./section-shell";

const TONE: Record<DeltaTone, string> = {
  up: "text-green-600",
  down: "text-red-600",
  flat: "text-text-muted",
  none: "text-text-muted",
};

// Last full week's numbers per client, read-only. Rows arrive from
// `npm run push:client-metrics` on a trusted machine; each client shows its
// newest complete week, flagged when that is older than the headline week. Clients with nothing connected are named underneath so
// the gap is a visible fact, not a missing row.
export function ClientMetricsSection({
  rows,
  clientOrder,
}: {
  rows: ClientMetric[];
  clientOrder: string[];
}) {
  const { headline, shown } = useMemo(() => latestPerClient(rows), [rows]);
  const behind = useMemo(
    () => Object.fromEntries(shown.map((s) => [s.row.client, s.behind])),
    [shown],
  );
  const week = useMemo(
    () => orderRows(shown.map((s) => s.row), clientOrder),
    [shown, clientOrder],
  );
  const { connected, notConnected } = useMemo(
    () => splitConnected(week),
    [week],
  );
  const trends = useMemo(
    () =>
      Object.fromEntries(
        connected.map((r) => [r.client, clientTrend(rows, r.client)]),
      ),
    [rows, connected],
  );
  const sample = headline;
  const checked = useMemo(() => {
    const latest = week.reduce<string | null>(
      (m, r) => (m && m > r.fetched_at ? m : r.fetched_at),
      null,
    );
    if (!latest) return null;
    return new Date(latest).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [week]);

  return (
    <SectionShell
      title="Client numbers"
      count={connected.length}
      countLabel="clients with data"
      rightSlot={
        sample ? (
          <span className="text-xs text-text-muted">
            Last full week, {weekLabel(sample.week_start, sample.week_end)},
            against the week before
          </span>
        ) : undefined
      }
    >
      {connected.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs italic text-text-muted">
          No client numbers pushed yet. Run{" "}
          <code>npm run push:client-metrics -- --write</code> on a machine that
          has the credentials.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-muted">
                <th className="px-5 py-2 font-medium">Client</th>
                {METRIC_COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {connected.map((r) => {
                const notes = throughNotes(r);
                const trend = trends[r.client];
                return (
                  <Fragment key={r.id}>
                    <tr className={cn(!trend && "border-b border-border")}>
                      <td className="px-5 py-2 align-top">
                        <div className="font-medium text-text">{r.client}</div>
                        {notes.map((n) => (
                          <div key={n} className="text-[11px] text-text-muted">
                            {n}
                          </div>
                        ))}
                        {behind[r.client] && (
                          <div className="text-[11px] text-amber-700">
                            {behind[r.client]}
                          </div>
                        )}
                        {r.note && (
                          <div className="text-[11px] text-text-muted">
                            {r.note}
                          </div>
                        )}
                      </td>
                      {METRIC_COLUMNS.map((c) => {
                        const now = num(r[c.key]);
                        const prev = num(r[c.prevKey]);
                        return (
                          <td
                            key={c.key}
                            className="px-3 py-2 text-right align-top tabular-nums"
                          >
                            {now == null ? (
                              <span
                                className="text-text-muted"
                                title="Not connected for this client"
                              >
                                —
                              </span>
                            ) : (
                              <>
                                <div className="font-semibold text-text">
                                  {fmtMetric(c, now)}
                                </div>
                                <div
                                  className={cn(
                                    "text-[11px]",
                                    TONE[deltaTone(now, prev)],
                                  )}
                                >
                                  {deltaLabel(now, prev)}
                                </div>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {trend && (
                      <tr className="border-b border-border">
                        <td
                          colSpan={METRIC_COLUMNS.length + 1}
                          className="px-5 pb-3 pt-0 text-xs leading-relaxed text-text-muted"
                        >
                          {trend}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(notConnected.length > 0 || checked) && (
        <div className="space-y-1 border-t border-border px-5 py-2 text-[11px] text-text-muted">
          {notConnected.length > 0 && (
            <p>
              No numbers connected yet:{" "}
              {notConnected.map((r) => r.client).join(", ")}.
            </p>
          )}
          {checked && (
            <p>
              Checked {checked}. Revenue is billed jobs where a client shares
              them; Search Console lags by two or three days.
            </p>
          )}
        </div>
      )}
    </SectionShell>
  );
}
