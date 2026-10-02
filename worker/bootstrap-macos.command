#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${GROWTH_WORKER_ENV_FILE:-$HOME/.config/growth-brain/worker.env}"
RUNNER="$SCRIPT_DIR/run-opencli-worker.command"
INSTALLER="$SCRIPT_DIR/install-macos-launchd.command"

echo "Growth Brain Worker bootstrap"
echo "1. 檢查本機設定"
echo "2. 真實執行一筆 pending AI 任務"
echo "3. 成功後才安裝 macOS 常駐 Worker"
echo

if [[ ! -f "$ENV_FILE" ]]; then
  echo "找不到本機環境檔：" >&2
  echo "  $ENV_FILE" >&2
  echo >&2
  echo "請先建立它，可參考：" >&2
  echo "  $SCRIPT_DIR/.env.example" >&2
  exit 2
fi

chmod 600 "$ENV_FILE"

if ! command -v node >/dev/null 2>&1; then
  echo "找不到 Node.js。" >&2
  exit 2
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node.js 需要 20 以上，目前是 $(node --version)。" >&2
  exit 2
fi

if ! command -v opencli >/dev/null 2>&1; then
  echo "找不到 opencli。請先安裝或更新 @jackwener/opencli。" >&2
  exit 2
fi

echo "[1/3] 本機環境已找到"
echo "Node: $(node --version)"
echo "OpenCLI: $(opencli --version 2>/dev/null | head -n 1 || echo unknown)"
echo

echo "[2/3] 執行一筆真實 Growth Brain AI 任務..."
set +e
GROWTH_RUN_ONCE=1 zsh "$RUNNER"
RESULT=$?
set -e

if [[ "$RESULT" -ne 0 ]]; then
  echo >&2
  echo "真實任務沒有成功，因此不安裝常駐 Worker。" >&2
  echo "請保留上方錯誤訊息；資料庫任務會保留 completed/failed 狀態供後續修正。" >&2
  exit "$RESULT"
fi

echo
echo "[3/3] 真實任務成功，安裝 macOS 常駐 Worker..."
zsh "$INSTALLER"

echo
echo "完成。"
echo "回到 Growth Brain → AI 團隊，可看到 Worker 心跳與 queue 狀態。"
