# Growth Brain Web — V1

正式網站：https://zhanbin8223-crypto.github.io/growth-brain-web/

這個 repository 是 Growth Brain 前端唯一 source of truth。正式前端以 `main` 為準，GitHub Pages 自動部署。

## V1 核心目標

Growth Brain 不是筆記收藏站，而是個人成長作業系統。V1 目前只驗證一條完整閉環：

```text
Website
  ↓
CEO / 路由判斷
  ↓
Supabase
  ↓
ai_jobs
  ↓
本機 Worker
  ↓
ChatGPT Web
  ↓
result + result_evidence 回寫 Supabase
  ↓
Website 顯示結果
```

CEO 的責任是維持單一主線、判斷目前真正目標、決定唯一下一步與調度執行；AI 回答本身不等於學會，也不自動算個人成長證據。

## 目前產品結構

- **首頁**：現在最重要的事、方向、成功證據與最近真實進展。
- **目標與作品**：輸入想達成的方向後，自動建立 GPT 路徑規劃任務；AI 結果只建立 candidate 作品，使用者確認後才成為 current。技能的 AI 初判與正式 evidence state 分開。
- **收集**：所有新內容的統一入口。手動貼上是保底方式；原始內容先保存，分類與路由可以晚一點決定。
- **學習陪伴**：保留來源、建立學習單元、提交自己的回答；如果已有 current 作品，新學習會自動掛回該作品。AI 結果與真正學習證據分開。
- **知識連結**：只顯示正式個人資料，現在已能把「來源 → 概念 → 學習證據 → 目前作品」連起來；系統／validation 資料不冒充個人知識。
- **系統／團隊**：顯示目前 CEO 階段、可調用員工、工作包與 Worker health（本機執行器心跳／在線狀態／queue）。

## 已驗證

- 正式 GitHub Pages 已部署。
- 正式網址：`https://zhanbin8223-crypto.github.io/growth-brain-web/`
- Supabase 為正式資料來源。
- `growth-home` Edge Function 已部署到 v11，已加入 personal_artifacts surface 與作品確認 action。
- Personal Synapse route 已部署，內部 RPC 只允許 service role 執行。
- `growth_control.ai_job_transition_v1` 已部署。
- `ai_jobs` 已啟用 RLS。
- 已建立正式作品資料層：
  - `growth_control.personal_artifacts`
  - `growth_control.artifact_skill_targets`
  - `growth_control.artifact_context_links`
  - AI 完成 `path_plan` 後只建立 candidate，不直接提升技能 evidence state。
- 作品 ↔ 學習 ↔ Synapse 自動關聯已通過 rollback 驗收。
- Worker heartbeat 已建立；AI 團隊頁可顯示 online/offline、最後心跳與 pending/processing queue。
- 正式 Chrome Worker 已改用真正驗證過的 `opencli browser growthbrain` 流程；輸入框使用語意定位＋AX fallback，回覆使用 per-job BEGIN/END marker readback。
- ChatGPT Web / OpenCLI Worker 已完成一次真正 E2E：
  - job: `ca93f427-7e91-4766-ab62-40abe58af8d7`
  - provider: `chatgpt_web_opencli`
  - result: `Growth Brain Worker E2E OK`
  - browser readback: true
  - 結果與 result_evidence 已寫回 `ai_jobs`。

## 目前唯一主線

現在不再處理「網站有沒有部署」或「AI 能不能接通」。

目前唯一尚未完成的 V1 核心驗收是：**讓新版 Chrome Worker 在使用者 Mac 上真正啟動，吃掉目前 pending 的真實 path_plan，並讓候選作品回到正式網站。**

```text
正式網站真實輸入（已完成）
→ 自動建立 ai_jobs（已完成）
→ 本機 Chrome Worker 啟動（目前唯一未完成）
→ ChatGPT Web 回覆
→ result / result_evidence 回寫 Supabase
→ 自動形成 candidate 作品
→ 正式網站讀取並顯示
→ 使用者確認後成為 current 作品
```

這條成功後，才算 V1 的網站 AI 閉環真正成立。

## AI Provider / API 模式

Growth Brain 的網站與資料模型不綁死 ChatGPT Web。

```text
Website
  → Supabase ai_jobs
  → Provider Adapter
      ├─ ChatGPT Web + 本機 Worker（目前使用）
      ├─ API（已預留）
      ├─ OpenAI-compatible API（已預留）
      └─ Local Model（已預留）
  → normalized result + evidence
  → Supabase
  → Website
```

- GPT 是推理／拆解員工，Supabase 才是長期記憶與正式狀態來源。
- API key / browser session 不進前端與 `ai_jobs`。
- 不同 provider 共用同一任務與結果契約，因此未來換 API 或本地模型不需要重寫作品／學習／路徑邏輯。
- AI 路徑規劃只先產生候選；沒有作品／回答／操作等真實證據，不得提升技能狀態。

目前有 1 筆真實 `path_plan` 任務仍為 `pending`；資料庫目前沒有正式 Worker heartbeat，也還沒有 candidate 作品。這是現在唯一真實 blocker。

## Auth / data boundary

- single-user private。
- Magic Link 只允許既有帳號：`create_user=false`。
- 瀏覽器只有 Supabase publishable key；service role / secret 只存在伺服器端。
- `growth-home` 由 Edge Function 驗證 user JWT，再用 service-side RPC 取得授權資料。
- 個人資料、system、validation 必須分離；validation 不可升級成個人成長證據。

## 本機預覽

```bash
python3 -m http.server 8766
```

本機只用於開發；正式驗收以 GitHub Pages + Supabase + 本機 Worker 的實際閉環為準。
