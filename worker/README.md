# Growth Brain 本機 AI Worker

目前正式推薦的 Worker：

- `chatgpt-browser-worker.mjs` — **正式主線**。直接使用 OpenCLI Browser 驅動你已登入的 Chrome ChatGPT；這就是先前真正成功過的路徑。
- `chatgpt-browser-worker.mjs` — 實驗備援，使用 OpenCLI 的 ChatGPT macOS 桌面 App adapter；不是目前 Web 驗證主線。
- `chatgpt-web-worker.mjs` — HTTP bridge 備援，需要另外存在 localhost OpenAI-compatible bridge。

## 正式資料流

```text
Supabase ai_jobs
  ↓
chatgpt-browser-worker.mjs
  ↓
OpenCLI Browser
  ↓
固定「Growth Brain Worker」對話
  ↓
ChatGPT 回覆
  ↓
result + result_evidence
  ↓
Supabase
```

Browser Worker 啟動前會先確認：

1. OpenCLI 可執行。
2. `opencli doctor --live` 通過，Browser Bridge 可用。
3. Chrome 已登入 ChatGPT。
4. 能切到標題為 `Growth Brain Worker` 的固定對話，或已設定固定 conversation URL。
5. preflight 通過後才會 claim AI 任務。

每次任務都會確認固定 conversation。輸入框先用 role/name 語意定位，失敗才回退到最新 AX ref；回覆用每筆 job 唯一 BEGIN/END 標記讀回，避免抓到上一筆回答。

## 安全邊界

- ChatGPT 登入狀態只留在本機 Chrome / OpenCLI。
- `SUPABASE_SECRET_KEY` 只放本機環境檔，不可提交 GitHub，也不可放網站前端。
- AI 回覆只是一筆候選推理結果，不會自動升級技能 evidence state（證據狀態）或作品完成狀態。
- Worker preflight 失敗時不 claim 任務，所以 pending 任務會安全留在 Supabase。

## 本機環境檔

建立：

```text
~/.config/growth-brain/worker.env
```

內容範例：

```bash
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SECRET_KEY="<server-secret>"
GROWTH_AUTH_USER_ID="<primary-auth-user-uuid>"

GROWTH_OPENCLI_BROWSER_SESSION="growthbrain"
GROWTH_CHATGPT_CONVERSATION_TITLE="Growth Brain Worker"

# 若要完全鎖死特定 conversation，可額外設定：
# GROWTH_CHATGPT_CONVERSATION_URL="https://chatgpt.com/c/<conversation-id>"

GROWTH_WORKER_ID="mac-opencli-growthbrain"
GROWTH_PROVIDER_KEY="chatgpt_web_opencli"
GROWTH_POLL_MS="4000"
GROWTH_HEARTBEAT_MS="15000"
GROWTH_CHATGPT_TIMEOUT_MS="240000"
```

建議權限：

```bash
chmod 600 ~/.config/growth-brain/worker.env
```

## 手動啟動

```bash
zsh worker/run-opencli-worker.command
```

只跑一筆：

```bash
GROWTH_RUN_ONCE=1 ./worker/run-opencli-worker.command
```

## macOS 自動啟動

先確認手動版能成功處理一筆任務，再執行：

```bash
zsh worker/install-macos-launchd.command
```

LaunchAgent 不保存 Supabase secret；它只呼叫 runner，而 runner 再讀取 `~/.config/growth-brain/worker.env`。如果有設定 `GROWTH_CHATGPT_CONVERSATION_URL`，Worker 會每次回到固定對話。

## 驗收

AI 團隊頁應看到：

- 本機執行器：在線
- 最後心跳在 30 秒內
- pending 任務被 claim
- 狀態依序 `claimed → processing → completed`
- result / result_evidence 回寫 Supabase
- path_plan 完成後形成候選作品，而不是直接變成正式能力

## 備援 Worker

`chatgpt-opencli-worker.mjs` 控制的是 ChatGPT macOS 桌面 App；`chatgpt-web-worker.mjs` 則需要額外 localhost HTTP bridge。兩者都先保留，但目前真正驗證過的是 `opencli browser growthbrain` 的 Chrome Web 路徑。
