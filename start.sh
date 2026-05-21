#!/usr/bin/env bash
# LabOS — one-command dev launcher
# Usage: ./start.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

VENV_PYTHON=""
for candidate in "$BACKEND/venv/bin/python3" "$BACKEND/.venv/bin/python3" \
    /opt/homebrew/bin/python3.12 /usr/bin/python3; do
  if [ -x "$candidate" ]; then VENV_PYTHON="$candidate"; break; fi
done

if [ -z "$VENV_PYTHON" ]; then
  echo "ERROR: No Python found. Run: python3 -m venv backend/venv && backend/venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

# Start backend
echo "Starting backend on :8000 ..."
"$VENV_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir "$BACKEND" &
BACKEND_PID=$!

# Give it a moment then check it came up
sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "ERROR: Backend failed to start. Check logs above."
  exit 1
fi
echo "Backend running (PID $BACKEND_PID)"

# Start frontend
echo "Starting frontend on :5173 ..."
cd "$FRONTEND" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "LabOS is running:"
echo "  App  -> http://localhost:5173"
echo "  API  -> http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Shut both down cleanly on Ctrl+C
trap 'echo "Stopping..."; kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null; exit 0' INT TERM

wait
