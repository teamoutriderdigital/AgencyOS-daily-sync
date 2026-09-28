const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
// Pure module, compiled in memory like the other board tests.
const code = ts.transpileModule(fs.readFileSync('src/lib/client-metrics.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = new Module('client-metrics'); mod._compile(code, 'client-metrics.cjs');
const { deltaLabel, deltaTone, weekLabel, formatDay, latestWeek, orderRows, splitConnected, throughNotes, metricToMarkdown, fmtMetric } = mod.exports;

const row = (client, extra = {}) => ({
  id: `${client}:2026-09-14`, client, week_start: '2026-09-14', week_end: '2026-09-20',
  organic_clicks: null, organic_clicks_prev: null, impressions: null, impressions_prev: null,
  sessions: null, sessions_prev: null, key_events: null, key_events_prev: null, revenue: null, revenue_prev: null,
  organic_through: null, traffic_through: null, revenue_through: null, source: '', note: null, sort_order: 0,
  fetched_at: '2026-09-24T09:00:00Z', updated_at: '2026-09-24T09:00:00Z', ...extra
});

test('delta reads as a signed whole percent, and says so when there is nothing to compare', () => {
  assert.equal(deltaLabel(41525, 34303), '+21%');
  assert.equal(deltaLabel(96, 114), '-16%');
  assert.equal(deltaLabel(100, 100), 'no change');
  assert.equal(deltaLabel(100, 99.8), 'no change');
  assert.equal(deltaLabel(5, 0), 'new');
  assert.equal(deltaLabel(0, 0), 'no change');
  assert.equal(deltaLabel(5, null), '');
  assert.equal(deltaTone(5, 4), 'up'); assert.equal(deltaTone(4, 5), 'down');
  assert.equal(deltaTone(4, 4), 'flat'); assert.equal(deltaTone(4, null), 'none');
});

test('money and counts format for reading aloud', () => {
  assert.equal(fmtMetric({ money: true }, 41525.4), '$41,525');
  assert.equal(fmtMetric({}, 14791), '14,791');
});

test('week label handles a month boundary and days name their weekday', () => {
  assert.equal(weekLabel('2026-09-14', '2026-09-20'), '14–20 Sep');
  assert.equal(weekLabel('2026-09-28', '2026-10-04'), '28 Sep – 4 Oct');
  assert.equal(formatDay('2026-09-19'), 'Sat 19 Sep');
});

test('only the newest pushed week shows, in clients-table order, with unknown clients after', () => {
  const rows = [
    row('SBD', { week_start: '2026-09-07', week_end: '2026-09-13', id: 'SBD:2026-09-07' }),
    row('TPP Soft Wash', { sort_order: 99 }), row('SBD'), row('ABS Cleaning')
  ];
  const latest = latestWeek(rows);
  assert.equal(latest.length, 3);
  assert.deepEqual(orderRows(latest, ['Redstone', 'SBD', 'ABS Cleaning']).map((r) => r.client), ['SBD', 'ABS Cleaning', 'TPP Soft Wash']);
  assert.deepEqual(latestWeek([]), []);
});

test('a client with no numbers is listed as not connected rather than dropped', () => {
  const { connected, notConnected } = splitConnected([row('COD', { note: 'no data connected' }), row('SBD', { sessions: 1114 })]);
  assert.deepEqual(connected.map((r) => r.client), ['SBD']);
  assert.deepEqual(notConnected.map((r) => r.client), ['COD']);
});

test('a source that stopped before Sunday is footnoted once, complete sources are not', () => {
  const r = row('SBD', { organic_clicks: 96, impressions: 7900, organic_through: '2026-09-19', sessions: 1114, traffic_through: '2026-09-20', revenue: 41525, revenue_through: '2026-09-20' });
  assert.deepEqual(throughNotes(r), ['Search Console through Sat 19 Sep, both weeks cut to match']);
  assert.deepEqual(throughNotes(row('COD')), []);
});

test('markdown line carries value and delta, and a dash where nothing is connected', () => {
  const r = row('SBD', { organic_clicks: 96, organic_clicks_prev: 114, impressions: '7900', impressions_prev: '9875', sessions: 1114, sessions_prev: 1169, key_events: 168, key_events_prev: 145, revenue: 41525, revenue_prev: 34303 });
  assert.equal(metricToMarkdown(r), '| SBD | 96 (-16%) | 7,900 (-20%) | 1,114 (-5%) | 168 (+16%) | $41,525 (+21%) |');
  assert.equal(metricToMarkdown(row('COD')), '| COD | — | — | — | — | — |');
});

const { clientTrend } = mod.exports;
const wk = (start, end, clicks, prev, extra = {}) => row('SV', { id: `SV:${start}`, week_start: start, week_end: end, organic_clicks: clicks, organic_clicks_prev: prev, ...extra });
const six = (pairs) => pairs.map(([c, p], i) => {
  const s = new Date(Date.UTC(2026, 7, 10 + i * 7)); const e = new Date(s); e.setUTCDate(s.getUTCDate() + 6);
  return wk(s.toISOString().slice(0, 10), e.toISOString().slice(0, 10), c, p);
});

test('trend names the last week, a streak, and the biggest earlier move', () => {
  const rows = six([[100, 80], [90, 100], [95, 90], [100, 95], [110, 100], [121, 110]]);
  assert.equal(clientTrend(rows, 'SV'),
    'Organic clicks rose 10% in 14–20 Sep, to 121, the fourth rise in a row. The biggest move of the last 6 weeks was 10–16 Aug, up 25%.');
});

test('a single move says what the week before did, and a smaller earlier move is not called out', () => {
  const rows = six([[100, 97], [96, 114]]);
  assert.equal(clientTrend(rows, 'SV'), 'Organic clicks fell 16% in 17–23 Aug, to 96, after rising 3% the week before.');
});

test('tiny numbers read as counts, not percentages', () => {
  assert.equal(clientTrend(six([[1, 1]]), 'SV'), 'Organic clicks are still small: 1 in 10–16 Aug, 1 the week before.');
});

test('no Search Console falls back to sessions; no rows gives no line', () => {
  const rows = [row('KEY', { sessions: 1129, sessions_prev: 2555 })];
  assert.equal(clientTrend(rows, 'KEY'), 'Sessions fell 56% in 14–20 Sep, to 1,129.');
  assert.equal(clientTrend(rows, 'COD'), null);
});

test('a week blanked for coverage is skipped, not read as zero', () => {
  const rows = [...six([[100, 95], [110, 100]]), wk('2026-08-24', '2026-08-30', null, null, { note: 'Search Console stopped' })];
  assert.match(clientTrend(rows, 'SV'), /^Organic clicks rose 10% in 17–23 Aug, to 110, the second rise in a row\.$/);
});
