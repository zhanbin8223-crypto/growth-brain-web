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
fi
if [[ -z "${OPENCLI_BIN:-}" && -x /opt/homebrew/bin/opencli ]]; then
  OPENCLI_BIN=/opt/homebrew/bin/opencli
fi
if [[ -z "${OPENCLI_BIN:-}" && -x /usr/local/bin/opencli ]]; then
  OPENCLI_BIN=/usr/local/bin/opencli
fi
export OPENCLI_BIN

if [[ -z "${OPENCLI_BIN:-}" || ! -x "$OPENCLI_BIN" ]]; then
  echo "OpenCLI not found. Install/update @jackwener/opencli or set OPENCLI_BIN in worker.env." >&2
  exit 2
fi

if [[ -z "${NODE_BIN:-}" ]]; then
  NODE_BIN="$(command -v node || true)"
fi
if [[ -z "${NODE_BIN:-}" && -x /opt/homebrew/bin/node ]]; then
  NODE_BIN=/opt/homebrew/bin/node
fi
if [[ -z "${NODE_BIN:-}" && -x /usr/local/bin/node ]]; then
  NODE_BIN=/usr/local/bin/node
fi

if [[ -z "${NODE_BIN:-}" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js not found. Set NODE_BIN in worker.env." >&2
  exit 2
fi

exec "$NODE_BIN" "$SCRIPT_DIR/chatgpt-browser-worker.mjs"
