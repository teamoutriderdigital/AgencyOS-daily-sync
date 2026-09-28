#!/usr/bin/env python3
"""Apply a SQL migration to the board's Supabase project from the terminal.

The anon key the site uses cannot run DDL, so migrations used to be a paste into
the Supabase SQL editor. This runs the same file over a direct Postgres
connection instead, in one transaction, so a re-run of an idempotent migration
is harmless and a failing one leaves nothing half-applied.

The connection string is read from DAILY_SYNC_SUPABASE_DB_URL — either exported
in the shell or stored (store-secret skill) as one line in
~/.config/agencyos/.env. It is never printed. Get it from the Supabase
dashboard: Project Settings → Database → Connection string → URI. The
"Session pooler" one (port 5432, host *.pooler.supabase.com) works from
machines without IPv6.

  python3 scripts/apply-migration.py supabase/migrations/028_client_metrics.sql
  python3 scripts/apply-migration.py --check client_metrics   # does the table exist?
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 is not installed: pip3 install psycopg2-binary")

VAR = "DAILY_SYNC_SUPABASE_DB_URL"


def db_url():
    value = os.environ.get(VAR)
    if not value:
        root = os.environ.get("AGENCYOS_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".config", "agencyos")
        path = os.path.join(root, ".env")
        if os.path.exists(path):
            for line in open(path):
                line = line.strip()
                if line.startswith(VAR + "="):
                    value = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not value:
        sys.exit(f"{VAR} is not set. Add one line '{VAR}=postgresql://…' to ~/.config/agencyos/.env "
                 "(Supabase → Project Settings → Database → Connection string → URI).")
    return value


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    conn = psycopg2.connect(db_url())
    try:
        with conn, conn.cursor() as cur:
            if argv[1] == "--check":
                cur.execute("select to_regclass(%s)", (f"public.{argv[2]}",))
                found = cur.fetchone()[0]
                print(f"{argv[2]}: {'exists' if found else 'missing'}")
                return 0 if found else 1
            path = argv[1]
            sql = open(path).read()
            cur.execute(sql)
            print(f"Applied {os.path.basename(path)}.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
