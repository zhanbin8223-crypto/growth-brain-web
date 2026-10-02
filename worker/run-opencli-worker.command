#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${GROWTH_WORKER_ENV_FILE:-$HOME/.config/growth-brain/worker.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing worker env file: $ENV_FILE" >&2
  exit 2
fi

chmod 600 "$ENV_FILE"
set -a
source "$ENV_FILE"
set +a

if [[ -z "${OPENCLI_BIN:-}" ]]; then
  OPENCLI_BIN="$(command -v opencli || true)"
  export OPENCLI_BIN
fi

if [[ -z "${OPENCLI_BIN:-}" || ! -x "$OPENCLI_BIN" ]]; then
  echo "OpenCLI not found. Install/update @jackwener/opencli or set OPENCLI_BIN in worker.env." >&2
  exit 2
fi

exec /usr/bin/env node "$SCRIPT_DIR/chatgpt-opencli-worker.mjs"
