#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SKILL_DIR="$ROOT/.cursor/skills/verify-carson"
RUN_DIR="${CARSON_VERIFY_RUN_DIR:-}"
if [[ -z "$RUN_DIR" && -f "$SKILL_DIR/.run/current-path" ]]; then
  RUN_DIR="$(cat "$SKILL_DIR/.run/current-path")"
fi
if [[ -z "$RUN_DIR" || ! -f "$RUN_DIR/run.json" ]]; then
  echo "No verification run to clean up."
  exit 0
fi

PID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$RUN_DIR/run.json")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null || true
  fi
fi

rm -rf "$RUN_DIR/chrome"
rm -f "$SKILL_DIR/.run/current" "$SKILL_DIR/.run/current-path"
echo "stopped pid=$PID runDir=$RUN_DIR"
echo "evidence kept at $SKILL_DIR/artifacts/"
