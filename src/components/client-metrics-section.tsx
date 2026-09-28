"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Fragment, useState } from "react";
import {
  METRIC_COLUMNS,
  clientTrend,
  trendSeries,
  type TrendPoint,
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

// Six-week sparkline for one client. Per the chart rules: the line sits in the
// quiet ink, the current week is the one accent-coloured point, and every
// week has a hover target with its value, since there is no axis.
const SPARK_W = 112;
const SPARK_H = 32;
const PAD = 4;

function Sparkline({
  measure,
  points,
}: {
  measure: string;
  points: TrendPoint[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2)
    return <span className="text-[11px] text-text-muted">—</span>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (SPARK_W - PAD * 2) / (points.length - 1);
  const xy = points.map((p, i) => ({
    x: PAD + i * step,
    y: PAD + (SPARK_H - PAD * 2) * (1 - (p.value - min) / span),
  }));
  const path = xy
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = xy.length - 1;
  const shown = hover ?? last;
  const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
  return (
    <div className="inline-flex flex-col items-start">
      <svg
        width={SPARK_W}
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        role="img"
        aria-label={`${measure}, last ${points.length} weeks: ${points.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-text-muted"
        />
        {hover != null && hover !== last && (
          <circle
            cx={xy[hover].x}
            cy={xy[hover].y}
            r={3}
            className="fill-text-muted"
          />
        )}
        <circle
          cx={xy[last].x}
          cy={xy[last].y}
          r={3.5}
          className="fill-accent stroke-surface"
          strokeWidth={1.5}
        />
        {xy.map((p, i) => (
          <rect
            key={i}
            x={p.x - step / 2}
            y={0}
            width={step}
            height={SPARK_H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          >
            <title>{`${points[i].label}: ${fmt(points[i].value)}`}</title>
          </rect>
        ))}
      </svg>
      <span className="mt-0.5 whitespace-nowrap text-[10px] text-text-muted">
        {points[shown].label}: {fmt(points[shown].value)}
      </span>
    </div>
  );
}

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
    () =>
      orderRows(
        shown.map((s) => s.row),
        clientOrder,
      ),
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
  const series = useMemo(
    () =>
      Object.fromEntries(
        connected.map((r) => [r.client, trendSeries(rows, r.client)]),
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
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-muted">
                <th className="px-5 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">6-week trend</th>
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
                      <td className="px-3 py-2 align-top">
                        <Sparkline {...series[r.client]} />
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
                          colSpan={METRIC_COLUMNS.length + 2}
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
