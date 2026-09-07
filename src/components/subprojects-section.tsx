'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { boardToday, deadlineLabel, PLANE_HOME, type SubprojectSnapshot } from '@/lib/subprojects';
import { SectionShell } from './section-shell';

export function SubprojectsSection() {
  const [snapshot, setSnapshot] = useState<SubprojectSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [today, setToday] = useState(() => boardToday());
  const inFlight = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setToday(boardToday());
    try {
      const response = await fetch('/api/subprojects', { cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Client work could not refresh.');
      setSnapshot(result);
      setError('');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Client work could not refresh.');
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(onFocus, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [refresh]);
  const rows = snapshot?.rows ?? [];
  return (
    <SectionShell title="Client work" count={rows.length} countLabel="subprojects" rightSlot={
      <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-md border border-border px-3 py-1 text-xs text-text disabled:opacity-50">
        {loading ? 'Refreshing…' : 'Refresh from Plane'}
      </button>
    }>
      <div className="space-y-2 border-b border-border px-5 py-3 text-xs text-text-muted" aria-live="polite">
        <p>One row per subproject. Oldest overdue task first; otherwise the latest active task. <a className="text-accent underline" href={PLANE_HOME} target="_blank" rel="noreferrer">All work and backlog in Plane ↗</a></p>
        <p>{snapshot?.fetchedAt ? `Checked ${new Date(snapshot.fetchedAt).toLocaleString('en-GB', { timeZone: 'America/Bogota' })} (Bogotá). Source data refreshes within 5 minutes; this view checks every 15 minutes and when reopened.` : loading ? 'Reading current work from Plane…' : 'No successful refresh yet.'}</p>
        {error && <p role="alert" className="font-medium text-red-700">{error}{snapshot ? ' Last successful rows are still shown below.' : ''}</p>}
        {snapshot?.warnings.map(warning => <p key={warning} className="text-amber-700">{warning}</p>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-alt text-xs text-text-muted"><tr>
            {['Client', 'Subproject', 'Latest / overdue task', 'Owner', 'Deadline'].map(label => <th key={label} scope="col" className="px-5 py-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => <tr key={row.id}>
              <td className="px-5 py-4 font-medium text-text">{row.client}</td>
              <td className="px-5 py-4 text-text">{row.subproject}<p className="mt-1 text-xs text-text-muted">{row.activeCount} active{row.overdueCount ? ` · ${row.overdueCount} overdue` : ''}</p>{row.subproject === 'Other active work' && <p className="mt-1 text-xs text-amber-700">Needs a subproject in Plane</p>}</td>
              <td className="max-w-md px-5 py-4"><a href={row.url} target="_blank" rel="noreferrer" className="text-text hover:text-accent hover:underline">{row.task}</a><p className="mt-1 text-xs text-text-muted">{row.status} · {row.reference}</p></td>
              <td className="px-5 py-4 text-text">{row.owner}</td>
              <td className={`whitespace-nowrap px-5 py-4 text-xs ${row.dueDate && row.dueDate < today ? 'text-red-700' : 'text-text-muted'}`}>{deadlineLabel(row.dueDate, today)}{row.missingDates > 0 && <p className="mt-1 text-amber-700">{row.missingDates} active task{row.missingDates === 1 ? '' : 's'} without a deadline</p>}</td>
            </tr>)}
          </tbody>
        </table>
        {!loading && !error && snapshot && rows.length === 0 && <p className="px-5 py-6 text-sm text-text-muted">{snapshot.warnings.length ? 'No active work could be displayed. Resolve the connection notices above.' : 'No active client work. Completed work and backlog remain in Plane.'}</p>}
      </div>
    </SectionShell>
  );
}
