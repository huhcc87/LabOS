#!/usr/bin/env bash
# LabOS — run everything on this Mac, free, no accounts.
#   ./run-local.sh            start database + website (data is kept between runs)
#   ./run-local.sh --admin    also create the first admin account (asks for a password)
# Open http://localhost:5173 when it says "ready". Press Ctrl+C to stop.
#
# The database is Convex's free local backend (127.0.0.1:3210). It stores data on this Mac in
# ~/.convex. It does NOT touch the cloud deployment. The old Python backend is not used by the app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/frontend"
export CONVEX_AGENT_MODE=anonymous

command -v node >/dev/null || { echo "Install Node 20+ first: brew install node"; exit 1; }
[ -d node_modules ] || npm ci

# The local database must be the one the site talks to: drop any cloud deployment id so it can't pick that.
if [ -f .env.local ] && grep -q '^CONVEX_DEPLOYMENT=' .env.local && ! grep -q '^CONVEX_DEPLOYMENT=anonymous' .env.local; then
  cp .env.local ".env.local.cloud-backup"
  grep -v '^CONVEX_DEPLOYMENT=' .env.local > .env.local.tmp && mv .env.local.tmp .env.local
  echo "Saved your old .env.local as frontend/.env.local.cloud-backup"
fi

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

echo "Starting the local database…"
npx convex dev >"$ROOT/.convex-local.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 90); do
  grep -q "functions ready" "$ROOT/.convex-local.log" 2>/dev/null && break
  kill -0 "${PIDS[0]}" 2>/dev/null || { echo "Database failed to start:"; tail -20 "$ROOT/.convex-local.log"; exit 1; }
  sleep 1
done
grep -q "functions ready" "$ROOT/.convex-local.log" || { echo "Database took too long. See .convex-local.log"; exit 1; }

if [ "${1:-}" = "--admin" ]; then
  read -r -p "Admin email: " EMAIL
  read -r -s -p "Admin password (12+ characters): " PW; echo
  npx convex run seedProdAdmin:createAdmin "$(printf '{"email":"%s","password":"%s","full_name":"Admin"}' "$EMAIL" "$PW")"
  unset PW
fi

echo "Database ready. Starting the website…"
npx vite --host 127.0.0.1 --port 5173 &
PIDS+=($!)
sleep 3
echo
echo "  LabOS is ready: http://localhost:5173"
echo "  Stop with Ctrl+C. Database log: $ROOT/.convex-local.log"
wait
