# Growth Brain 本機 AI Worker

目前正式推薦的 Worker：

- `chatgpt-opencli-worker.mjs` — **主線**。直接使用 OpenCLI 內建 ChatGPT Web adapter，沿用你已登入的 ChatGPT 網頁版。
- `chatgpt-web-worker.mjs` — 備援。需要另外存在 localhost OpenAI-compatible HTTP bridge；不是目前已驗證主線。

## 正式資料流

```text
Supabase ai_jobs
  ↓
chatgpt-opencli-worker.mjs
  ↓
OpenCLI ChatGPT Web adapter
  ↓
固定「Growth Brain Worker」對話
  ↓
ChatGPT 回覆
  ↓
result + result_evidence
  ↓
Supabase
```

OpenCLI Worker 啟動前會先確認：

1. OpenCLI 可執行。
2. ChatGPT Web 已登入。
3. 能找到標題為 `Growth Brain Worker` 的固定對話，或已設定固定 conversation URL。
4. preflight 通過後才會 claim AI 任務。

每次任務都會重新打開固定 conversation，並檢查回覆仍屬於同一對話；如果跑到錯對話，不會把結果寫回正式資料。

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

GROWTH_CHATGPT_CONVERSATION_TITLE="Growth Brain Worker"

# 若要完全鎖死特定 conversation，可額外設定：
# GROWTH_CHATGPT_CONVERSATION_URL="https://chatgpt.com/c/<conversation-id>"

GROWTH_WORKER_ID="mac-opencli-growthbrain"
GROWTH_PROVIDER_KEY="chatgpt_web_opencli"
GROWTH_POLL_MS="4000"
GROWTH_HEARTBEAT_MS="15000"
GROWTH_CHATGPT_TIMEOUT="240"
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

LaunchAgent 不保存 Supabase secret；它只呼叫 runner，而 runner 再讀取 `~/.config/growth-brain/worker.env`。

## 驗收

AI 團隊頁應看到：

- 本機執行器：在線
- 最後心跳在 30 秒內
- pending 任務被 claim
- 狀態依序 `claimed → processing → completed`
- result / result_evidence 回寫 Supabase
- path_plan 完成後形成候選作品，而不是直接變成正式能力

## 備援 HTTP bridge Worker

`chatgpt-web-worker.mjs` 仍保留，方便未來使用 OpenAI-compatible localhost bridge。但目前不要把它當作已驗證主線。
