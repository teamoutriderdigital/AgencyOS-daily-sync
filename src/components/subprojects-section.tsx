'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import {
  boardToday, dbToRow, deadlineLabel, PLANE_HOME, sortRows,
  type SubprojectDbRow, type SubprojectRow
} from '@/lib/subprojects';
import { SectionShell } from './section-shell';

// Client work, read from the `plane_subprojects` snapshot. The rows are computed
// from Plane and pushed in from a trusted machine (`npm run push:subprojects`),
// so no Plane credential exists on the deployment — the board is a reader only.
// Realtime means a push lands in every open board without a reload.
export function SubprojectsSection() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SubprojectRow[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [today, setToday] = useState(() => boardToday());

  const read = useCallback(async () => {
    setLoading(true);
    setToday(boardToday());
    const [rowsResp, metaResp] = await Promise.all([
      supabase.from('plane_subprojects').select('*'),
      supabase.from('plane_snapshot_meta').select('*').eq('id', 1).maybeSingle()
    ]);
    if (rowsResp.error) {
      setError('Client work could not load from the board database.');
    } else {
      setRows(sortRows((rowsResp.data as SubprojectDbRow[]).map(dbToRow)));
      setError('');
    }
    if (!metaResp.error && metaResp.data) {
      setFetchedAt(metaResp.data.fetched_at as string);
      setWarnings((metaResp.data.warnings as string[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void read();
  }, [read]);

  // A push replaces the whole snapshot, so re-read on any change rather than
  // patching row by row.
  useEffect(() => {
    const channel = supabase
      .channel('board:plane_subprojects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plane_snapshot_meta' }, () => void read())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, read]);

  const list = rows ?? [];
  const stale = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() > 36 * 60 * 60 * 1000 : false;
  return (
    <SectionShell title="Client work" count={list.length} countLabel="subprojects" rightSlot={
      <button type="button" onClick={() => void read()} disabled={loading} className="rounded-md border border-border px-3 py-1 text-xs text-text disabled:opacity-50">
        {loading ? 'Loading…' : 'Reload'}
      </button>
    }>
      <div className="space-y-2 border-b border-border px-5 py-3 text-xs text-text-muted" aria-live="polite">
        <p>One row per subproject. Oldest overdue task first; otherwise the latest active task. <a className="text-accent underline" href={PLANE_HOME} target="_blank" rel="noreferrer">All work and backlog in Plane ↗</a></p>
        <p>
          {fetchedAt
            ? `Snapshot from Plane, taken ${new Date(fetchedAt).toLocaleString('en-GB', { timeZone: 'America/Bogota' })} (Bogotá).`
            : loading ? 'Loading the current snapshot…' : 'No snapshot has been pushed yet.'}
        </p>
        {stale && <p className="font-medium text-amber-700">This snapshot is more than a day old — run the push before trusting it.</p>}
        {error && <p role="alert" className="font-medium text-red-700">{error}</p>}
        {warnings.map(warning => <p key={warning} className="text-amber-700">{warning}</p>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-alt text-xs text-text-muted"><tr>
            {['Client', 'Subproject', 'Latest / overdue task', 'Owner', 'Deadline'].map(label => <th key={label} scope="col" className="px-5 py-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {list.map(row => <tr key={row.id}>
              <td className="px-5 py-4 font-medium text-text">{row.client}</td>
              <td className="px-5 py-4 text-text">{row.subproject}<p className="mt-1 text-xs text-text-muted">{row.activeCount} active{row.overdueCount ? ` · ${row.overdueCount} overdue` : ''}</p>{row.subproject === 'Other active work' && <p className="mt-1 text-xs text-amber-700">Needs a subproject in Plane</p>}</td>
              <td className="max-w-md px-5 py-4"><a href={row.url} target="_blank" rel="noreferrer" className="text-text hover:text-accent hover:underline">{row.task}</a><p className="mt-1 text-xs text-text-muted">{row.status} · {row.reference}</p></td>
              <td className="px-5 py-4 text-text">{row.owner}</td>
              <td className={`whitespace-nowrap px-5 py-4 text-xs ${row.dueDate && row.dueDate < today ? 'text-red-700' : 'text-text-muted'}`}>{deadlineLabel(row.dueDate, today)}{row.missingDates > 0 && <p className="mt-1 text-amber-700">{row.missingDates} active task{row.missingDates === 1 ? '' : 's'} without a deadline</p>}</td>
            </tr>)}
          </tbody>
        </table>
        {!loading && !error && rows && list.length === 0 && <p className="px-5 py-6 text-sm text-text-muted">{fetchedAt ? 'No active client work in the last snapshot. Completed work and backlog remain in Plane.' : 'Run the client-work push to fill this section.'}</p>}
      </div>
    </SectionShell>
  );
}
