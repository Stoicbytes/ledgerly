#!/usr/bin/env bash
# Applies every migration, in order, to an empty Postgres database, twice: a new project must
# build from this folder alone, and each file must be safe to run again.
# Usage: DATABASE_URL=postgres://user:pass@host:5432/db supabase/tests/fresh_install.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export PGOPTIONS="-c client_min_messages=warning"
run() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@" >/dev/null; }

run -f "$here/supabase_stub.sql"
for pass in 1 2; do
  for file in "$here"/../migrations/*.sql; do
    echo "pass $pass: $(basename "$file")"
    run -f "$file"
  done
done
echo "All migrations applied twice on an empty database."
