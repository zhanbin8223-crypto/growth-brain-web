#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="$SCRIPT_DIR/run-opencli-worker.command"
ENV_FILE="${GROWTH_WORKER_ENV_FILE:-$HOME/.config/growth-brain/worker.env}"
LABEL="com.growthbrain.opencli-worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/GrowthBrain"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing worker env file: $ENV_FILE" >&2
  echo "Create it first; see worker/README.md." >&2
  exit 2
fi

chmod 600 "$ENV_FILE"
chmod +x "$RUNNER"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>$RUNNER</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/worker.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/worker.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed: $PLIST"
echo "Worker logs: $LOG_DIR"
echo "Check the Growth Brain AI 團隊 page for heartbeat status."
