#!/usr/bin/env python3
"""Push last full week's client numbers onto the weekly L10 board.

One row per client on the board's `clients` table (plus TPP, which is not on
it yet): organic clicks, impressions, sessions, key events and revenue for the
last complete Monday-to-Sunday week, each with the same days from the week
before. Rows land in `client_metrics` (migration 028) and the Client numbers
section on /weekly shows the newest week.

Where the numbers come from — read on this machine, never on Vercel:

  warehouse   The Master Dashboard Supabase the weekly client reports read
              (ga4_snapshots, gsc_daily_totals). Credentials come from
              `../Weekly Montly reporting/.env.local` via that repo's
              _report_shared/common.py. SBD, ABS, Supply Velocity, Redstone, TPP.
  sheets      A client's own dashboard feed Sheet, readable without
              credentials: SBD (published tabs), TPP and Key Healthcare (public
              gviz). Preferred over the warehouse whenever it is current.
  csv         SBD billed revenue from the Fieldd export the reporting repo
              keeps at clients/smith-bros-mobile-detailing/revenue/YYYY-MM.csv.
              The export's last day is usually partial; it never falls inside
              a completed week, so it does not matter here.

Search Console lags two or three days. When a source stops before Sunday, both
weeks are cut to the same weekdays and the `*_through` date says so; the board
footnotes it. A client with nothing connected still gets a row, with a note,
so the gap stays visible in the meeting.

  npm run push:client-metrics                  # dry run: print rows + markdown
  npm run push:client-metrics -- --write       # upsert into client_metrics
  npm run push:client-metrics -- --week=2026-09-14   # newest week = that Monday
  npm run push:client-metrics -- --weeks=6     # weeks written (default 6)
  npm run push:client-metrics -- --markdown    # only the agenda table

Six weeks are written each run (the board's trend line under each client reads
them); the table shows the newest. Safe to re-run: upserts on
"<client>:<week_start>".
"""
import argparse
import csv
import datetime as dt
import glob
import io
import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.realpath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
REPORTING = os.environ.get("REPORTING_DIR") or os.path.abspath(
    os.path.join(ROOT, "..", "..", "Weekly Montly reporting")
)

# Board client name -> where its numbers live. org_id is the warehouse
# organizations.id (the same one clients/<slug>/client.json carries in the
# reporting repo). Names must match the board's clients table exactly.
SBD_PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRO5FOESHQfGjP6uZhogNMprPhIAfsT9sewDYTsbAjhLE6cUleyBqiVrWa85-6YMuMkqS_I6inNhW1H/pub"
KEY_SHEET = "1693hg0vYmoX1zHfiDlaF734B-W3pmBvW11UdLHvKm_Y"
TPP_SHEET = "1hLCaH89BbQ2QPuv1EF7BTtSNEnondxc9BUS2DKsxk1g"


def gviz(sheet_id, tab):
    return (f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?"
            + urllib.parse.urlencode({"tqx": "out:csv", "sheet": tab}))


def sheet_pair(search_url, search_cols, analytics_url, analytics_cols):
    """A client whose dashboard Sheet has a daily Search Console tab and a daily
    GA4 tab. *_cols map the tab's column header -> our metric."""
    return [
        {"url": search_url, "label": "Search Console", "through_key": "organic_through", "fields": search_cols},
        {"url": analytics_url, "label": "Analytics", "through_key": "traffic_through", "fields": analytics_cols},
    ]


# Board client name -> where its numbers live. Names must match the board's
# clients table exactly.
#   warehouse  the Master Dashboard Supabase (org_id = organizations.id). Its
#              "ops" Google sign-in expired 21 Sep 2026, which froze every
#              client on it; prefer a client's own dashboard Sheet when it has
#              a current one.
#   sheets     the client's dashboard feed Sheet, read without credentials
#              (published CSV or public gviz), the same data the dashboard shows.
SOURCES = {
    # SBD dashboard (growtharchon.github.io/sbd-dashboard) published tabs.
    "SBD": {"kind": "sheets", "revenue_slug": "smith-bros-mobile-detailing", "feeds": sheet_pair(
        f"{SBD_PUB}?gid=255381674&single=true&output=csv", {"Clicks": "organic_clicks", "Impressions": "impressions"},
        f"{SBD_PUB}?gid=532718338&single=true&output=csv", {"Sessions": "sessions", "Key events": "key_events"})},
    "ABS Cleaning": {"kind": "warehouse", "org_id": "8dfbcf37-af9f-4444-8470-4d675c2b25da"},
    "Supply Velocity": {"kind": "warehouse", "org_id": "3ff7911b-6887-4e16-bcdc-99bb5353f4c8"},
    "Redstone": {"kind": "warehouse", "org_id": "811e9c11-7d8a-4832-a611-7003d6bffc51"},
    # TPP dashboard (team-agencyos/tpp-dashboard) public Sheet.
    "TPP Soft Wash": {"kind": "sheets", "feeds": sheet_pair(
        gviz(TPP_SHEET, "GSC_Daily"), {"Clicks": "organic_clicks", "Impressions": "impressions"},
        gviz(TPP_SHEET, "GA4_Daily"), {"Sessions": "sessions", "Key Events": "key_events"})},
    # Key Healthcare dashboard feed Sheet (Apps Script under team@tryagencyos.ai).
    "Key Healthcare": {"kind": "sheets", "feeds": sheet_pair(
        gviz(KEY_SHEET, "search"), {"Clicks": "organic_clicks", "Impressions": "impressions"},
        gviz(KEY_SHEET, "analytics"), {"Sessions": "sessions", "Key events": "key_events"})},
}
# Clients with numbers but no row on the board's clients table yet. They are
# appended after the table's own order; adding them to the table is a business
# call, not something this script makes.
EXTRA_CLIENTS = ["TPP Soft Wash"]

METRICS = ["organic_clicks", "impressions", "sessions", "key_events", "revenue"]


# ── env ───────────────────────────────────────────────────────────────────────
def board_env():
    path = os.path.join(ROOT, ".env.local")
    if not os.path.exists(path):
        sys.exit("No .env.local in daily-sync-board — this script only runs on a machine that has the credentials.")
    out = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    for key in ("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"):
        if not out.get(key):
            sys.exit(f"Missing {key} in .env.local")
    return out


def warehouse():
    """The reporting repo's Supabase reader, with that repo's credentials."""
    shared = os.path.join(REPORTING, "_report_shared")
    if not os.path.isdir(shared):
        sys.exit(f"Reporting repo not found at {REPORTING} (set REPORTING_DIR).")
    sys.path.insert(0, shared)
    from common import sb_select  # noqa: E402
    return sb_select


# ── dates ─────────────────────────────────────────────────────────────────────
def last_full_week(today=None):
    today = today or dt.date.today()
    this_monday = today - dt.timedelta(days=today.weekday())
    start = this_monday - dt.timedelta(days=7)
    return start, start + dt.timedelta(days=6)


# A source has to cover at least this many days of the week to be shown. A
# feed that died on Monday would otherwise turn "sessions this week" into one
# day's number with a confident-looking percentage next to it.
MIN_DAYS = 5


def window(week_start, week_end, latest):
    """Cut both weeks to the days the source has. Returns (through, prev_start,
    prev_end), or None when the source covers too little of the week."""
    if latest is None:
        return None
    through = min(week_end, latest)
    days = (through - week_start).days + 1
    if days < MIN_DAYS:
        return None
    prev_start = week_start - dt.timedelta(days=7)
    return through, prev_start, prev_start + dt.timedelta(days=days - 1)


def coverage_note(label, latest, week_start):
    if latest is None:
        return f"{label}: no data at all"
    if latest < week_start:
        return f"{label} stopped {latest:%a %-d %b}, before the week began"
    return f"{label} stopped {latest:%a %-d %b}, too little of the week to show"


def total(rows, start, end, field):
    return sum(float(r.get(field) or 0) for r in rows if start <= r["date"] <= end)


def iso(d):
    return d.isoformat() if isinstance(d, dt.date) else d


def parse_date(s):
    try:
        return dt.date.fromisoformat(str(s).strip()[:10])
    except ValueError:
        return None


# ── sources ───────────────────────────────────────────────────────────────────
# A feed is one source's daily rows plus how to read them. It is loaded once
# for the whole span and every week is computed from it, so six weeks cost the
# same number of reads as one.
def feed(label, through_key, fields, rows):
    rows = [r for r in rows if r.get("date")]
    return {"label": label, "through_key": through_key, "fields": fields, "rows": rows,
            "latest": max((r["date"] for r in rows), default=None)}


def warehouse_feeds(sb, org_id, span_start, span_end):
    """One bounded range read per table. An `order=date.desc&limit=1` probe for
    the latest date sorts the whole table and times out for the busy orgs, so
    the latest date comes from the rows in range instead."""
    out = []
    for table, label, fields, through_key in (
        ("gsc_daily_totals", "Search Console", {"clicks": "organic_clicks", "impressions": "impressions"}, "organic_through"),
        ("ga4_snapshots", "Analytics", {"sessions": "sessions", "conversions": "key_events"}, "traffic_through"),
    ):
        rows = sb(table, {
            "org_id": f"eq.{org_id}",
            "select": "date," + ",".join(fields),
            "and": f"(date.gte.{span_start},date.lte.{span_end})",
        })
        for r in rows:
            r["date"] = parse_date(r["date"])
        out.append(feed(label, through_key, fields, rows))
    return out


def csv_rows(url):
    """Daily rows from a CSV feed, one per date. Some feed tabs repeat a day
    when their script re-runs; the last copy wins so nothing is counted twice."""
    with urllib.request.urlopen(url, timeout=60) as resp:
        text = resp.read().decode("utf-8", "replace")
    by_date = {}
    for r in csv.DictReader(io.StringIO(text)):
        d = parse_date(r.get("Date"))
        if d:
            by_date[d] = {"date": d, **{k: v for k, v in r.items() if k != "Date"}}
    return list(by_date.values())


def number(v):
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("%", "").strip() or 0)
    except ValueError:
        return 0.0


def sheet_feeds(specs, span_start, span_end):
    """The feed's newest date is taken over the whole tab, not the span: GA4
    leaves out days with no visits, so a quiet week on a small site (TPP) has
    gaps that are zeros, not a stopped feed."""
    out = []
    for spec in specs:
        all_rows = csv_rows(spec["url"])
        rows = [{"date": r["date"], **{col: number(r.get(col)) for col in spec["fields"]}}
                for r in all_rows if span_start <= r["date"] <= span_end]
        f = feed(spec["label"], spec["through_key"], spec["fields"], rows)
        f["latest"] = max((r["date"] for r in all_rows), default=None)
        out.append(f)
    return out


def revenue_feed(slug, span_start, span_end):
    rows = []
    for path in sorted(glob.glob(os.path.join(REPORTING, "clients", slug, "revenue", "*.csv"))):
        with open(path, newline="") as f:
            for r in csv.DictReader(f):
                key = {k.strip().lower(): v for k, v in r.items() if k}
                d = parse_date(key.get("date"))
                amt = (key.get("amount") or "").replace("$", "").replace(",", "").strip()
                if d and amt and span_start <= d <= span_end:
                    rows.append({"date": d, "amount": float(amt)})
    return feed("Revenue export", "revenue_through", {"amount": "revenue"}, rows)


def week_values(feeds, week_start, week_end):
    """Every metric the feeds can give for one week, cut like for like."""
    out, notes = {}, []
    for f in feeds:
        latest = min(f["latest"], week_end) if f["latest"] else None
        win = window(week_start, week_end, latest)
        if not win:
            notes.append(coverage_note(f["label"], latest, week_start))
            continue
        through, prev_start, prev_end = win
        for src, dest in f["fields"].items():
            out[dest] = total(f["rows"], week_start, through, src)
            out[dest + "_prev"] = total(f["rows"], prev_start, prev_end, src)
        out[f["through_key"]] = iso(through)
    return out, notes


# ── board ─────────────────────────────────────────────────────────────────────
def board_request(env, table, method="GET", query="", body=None):
    key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if method == "POST":
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}" + (f"?{query}" if query else "")
    req = urllib.request.Request(url, method=method, headers=headers,
                                 data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", "replace")
        return json.loads(raw) if raw.strip() else None


def build_rows(env, weeks, sb):
    """Rows for every client for every (week_start, week_end) in `weeks`. The
    board shows the newest week in the table and reads the rest as the trend
    behind each client's line."""
    clients = board_request(env, "clients", query="select=name,sort_order&order=sort_order.asc,name.asc")
    names = [c["name"] for c in clients] + [n for n in EXTRA_CLIENTS if n not in {c["name"] for c in clients}]
    span_start = weeks[0][0] - dt.timedelta(days=7)
    span_end = weeks[-1][1]
    fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
    rows, warnings = [], []
    for i, name in enumerate(names):
        src = SOURCES.get(name)
        feeds, kind, load_error = [], "", None
        if src:
            try:
                if src["kind"] == "warehouse":
                    feeds = warehouse_feeds(sb(), src["org_id"], span_start, span_end)
                else:
                    feeds = sheet_feeds(src["feeds"], span_start, span_end)
                kind = src["kind"]
                if src.get("revenue_slug"):
                    rev = revenue_feed(src["revenue_slug"], span_start, span_end)
                    if rev["rows"]:
                        feeds.append(rev)
                        kind += "+csv"
            except Exception as e:  # one broken source must not blank the board
                load_error = f"read failed: {e}"
                warnings.append(f"{name}: {load_error}")
        for week_start, week_end in weeks:
            row = {
                "id": f"{name}:{week_start}", "client": name,
                "week_start": iso(week_start), "week_end": iso(week_end),
                "source": kind, "note": None, "sort_order": i, "fetched_at": fetched_at,
            }
            for m in METRICS:
                row[m] = row[m + "_prev"] = None
            for k in ("organic_through", "traffic_through", "revenue_through"):
                row[k] = None
            if not src:
                row["note"] = "no data connected"
            elif not load_error:
                got, notes = week_values(feeds, week_start, week_end)
                row.update(got)
                if notes:
                    # The reason a number is missing belongs on the board row.
                    row["note"] = "; ".join(notes)[:200]
                    if (week_start, week_end) == weeks[-1]:
                        warnings.append(f"{name}: " + "; ".join(notes))
            if src and all(row[m] is None for m in METRICS) and not row["note"]:
                row["note"] = "connected, but nothing for this week yet"
            rows.append(row)
    return rows, warnings


# ── output ────────────────────────────────────────────────────────────────────
def fmt(value, money=False):
    if value is None:
        return "—"
    text = f"{round(value):,}"
    return f"${text}" if money else text


def delta(now, prev):
    if now is None or prev is None:
        return ""
    if prev == 0:
        return "no change" if now == 0 else "new"
    pct = round((now - prev) / prev * 100)
    if pct == 0:
        return "no change"
    return f"{'+' if pct > 0 else '-'}{abs(pct)}%"


def markdown(rows, week_start, week_end):
    lines = [
        f"| Client | Organic clicks | Impressions | Sessions | Key events | Revenue |",
        "|---|---|---|---|---|---|",
    ]
    missing, stalled = [], []
    for r in rows:
        if all(r[m] is None for m in METRICS):
            (missing if r.get("note") == "no data connected" else stalled).append(r)
            continue
        cells = []
        for m in METRICS:
            v = r[m]
            if v is None:
                cells.append("—")
                continue
            d = delta(v, r[m + "_prev"])
            cells.append(f"{fmt(v, m == 'revenue')} ({d})" if d else fmt(v, m == "revenue"))
        lines.append(f"| {r['client']} | " + " | ".join(cells) + " |")
    head = f"Last full week, {week_start:%-d} to {week_end:%-d %b}, against the same days the week before."
    notes = []
    for r in rows:
        for key, label in (("organic_through", "Search Console"), ("traffic_through", "Analytics"), ("revenue_through", "Revenue")):
            t = r.get(key)
            if t and parse_date(t) < week_end:
                notes.append(f"{r['client']}: {label} through {parse_date(t):%a %-d %b}, both weeks cut to match.")
    out = [head, ""] + lines
    if notes:
        out += [""] + notes
    for r in stalled:
        out += ["", f"{r['client']}: no numbers this week. {r['note'] or 'Nothing for this week yet'}."]
    if missing:
        out += ["", "No numbers connected yet: " + ", ".join(r["client"] for r in missing) + "."]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true", help="upsert the rows (default: dry run)")
    ap.add_argument("--week", help="Monday of the newest week to compute, YYYY-MM-DD (default: last full week)")
    ap.add_argument("--weeks", type=int, default=6, help="how many weeks back to write (default 6, for the trend line)")
    ap.add_argument("--markdown", action="store_true", help="print only the agenda table")
    args = ap.parse_args()

    if args.week:
        week_start = dt.date.fromisoformat(args.week)
        if week_start.weekday() != 0:
            sys.exit("--week must be a Monday")
    else:
        week_start, _ = last_full_week()
    weeks = [(week_start - dt.timedelta(days=7 * n), week_start - dt.timedelta(days=7 * n) + dt.timedelta(days=6))
             for n in range(max(args.weeks, 1) - 1, -1, -1)]
    week_start, week_end = weeks[-1]

    env = board_env()
    _sb = []

    def sb():
        if not _sb:
            _sb.append(warehouse())
        return _sb[0]

    rows, warnings = build_rows(env, weeks, sb)
    newest = [r for r in rows if r["week_start"] == iso(week_start)]

    if args.markdown:
        print(markdown(newest, week_start, week_end))
        return

    print(f"Weeks {weeks[0][0]} to {week_end} ({len(weeks)} weeks); table below is the newest.")
    for r in newest:
        print(f"  {r['client']:18} " + "  ".join(f"{m}={fmt(r[m], m == 'revenue')}{(' ' + delta(r[m], r[m + '_prev'])) if delta(r[m], r[m + '_prev']) else ''}" for m in METRICS)
              + (f"  [{r['note']}]" if r["note"] else ""))
    for w in warnings:
        print(f"  warning: {w}")
    print()
    print(markdown(newest, week_start, week_end))
    print()
    if not args.write:
        print("Dry run — nothing written. Add --write to push these rows to client_metrics.")
        return
    board_request(env, "client_metrics", method="POST", body=rows)
    print(f"Wrote {len(rows)} rows to client_metrics ({len(weeks)} weeks, newest {week_start}).")


if __name__ == "__main__":
    main()
