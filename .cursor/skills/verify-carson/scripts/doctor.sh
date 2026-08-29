#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SKILL_DIR="$ROOT/.cursor/skills/verify-carson"
RUN_DIR="${CARSON_VERIFY_RUN_DIR:-}"
if [[ -z "$RUN_DIR" && -f "$SKILL_DIR/.run/current-path" ]]; then
  RUN_DIR="$(cat "$SKILL_DIR/.run/current-path")"
fi
if [[ -z "$RUN_DIR" || ! -f "$RUN_DIR/run.json" ]]; then
  echo "No verification run. Launch first with scripts/launch.sh." >&2
  exit 1
fi

HOST="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["host"])' "$RUN_DIR/run.json")"
PORT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["port"])' "$RUN_DIR/run.json")"
PID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$RUN_DIR/run.json")"
URL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$RUN_DIR/run.json")"

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Vite pid $PID is not running." >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  LISTEN_PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -z "$LISTEN_PID" ]]; then
    echo "Nothing listens on $HOST:$PORT." >&2
    exit 1
  fi
  if [[ "$LISTEN_PID" != "$PID" ]]; then
    echo "Port $PORT is owned by pid $LISTEN_PID, not this run's Vite pid $PID. Do not drive it." >&2
    exit 1
  fi
fi

HTML="$(curl -fsS "$URL")"
if ! grep -q '<title>Carson</title>' <<<"$HTML"; then
  echo "$URL did not return the Carson document." >&2
  exit 1
fi

echo "ok pid=$PID url=$URL host=$HOST port=$PORT"
