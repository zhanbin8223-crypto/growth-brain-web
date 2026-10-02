# Growth Brain 本機 AI Worker

用途：從 Growth Brain 的 `ai_jobs` 取出待處理任務，交給你 Mac 上的 ChatGPT Web bridge，再把結果與 evidence 寫回 Supabase。

## 安全邊界

- ChatGPT 登入狀態只留在本機瀏覽器／bridge。
- `SUPABASE_SECRET_KEY` 只放本機環境變數，不可提交 GitHub，也不可放網站前端。
- Worker 預設只接受 `localhost / 127.0.0.1 / ::1` 的 bridge URL；遠端網址會直接拒絕。
- AI 回覆只是一筆輔助結果，不會自動升級 Learning evidence 或個人進展。

## 建議 bridge

目前評估採用 `Octo-Lex/ChatGPT-Web2API` 作為第一個實驗 bridge。它提供 OpenAI-compatible 的 `POST /v1/chat/completions`，預設可跑在 `http://localhost:8080`。

安裝與第一次登入依上游專案說明進行。這是第三方 bridge，ChatGPT Web 介面改版時可能需要更新。

## 啟動

1. 複製 `.env.example` 為本機自己的 `.env`，填入 Supabase URL、server-side secret、既有 Auth user UUID。
2. 啟動本機 ChatGPT Web bridge，確認它只監聽 localhost。
3. 載入環境變數後執行：

```bash
node worker/chatgpt-web-worker.mjs
```

只測一次：

```bash
GROWTH_RUN_ONCE=1 node worker/chatgpt-web-worker.mjs
```

狀態流：`pending → claimed → processing → completed / failed`。失敗任務可由 Learning 頁重新排回 pending。
