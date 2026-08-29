#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
exec node "$ROOT/.cursor/skills/verify-carson/scripts/start-vite.mjs"
