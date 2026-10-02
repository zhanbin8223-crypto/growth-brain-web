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
- **主線／專案**：建立候選主線，再由使用者確認；AI 不會自動替使用者承諾目標。
- **收件匣**：先保存原始內容，再分類成知識、學習、專案或行動。
- **學習陪伴**：保留來源、建立學習單元、提交自己的回答；AI 結果與真正學習證據分開。
- **知識連結**：只顯示正式個人資料，系統／validation 資料不冒充個人知識。
- **系統**：顯示核心閉環、AI queue、Worker、部署與系統阻塞。

## 已驗證

- 正式 GitHub Pages 已部署。
- 正式網址：`https://zhanbin8223-crypto.github.io/growth-brain-web/`
- Supabase 為正式資料來源。
- `growth-home` Edge Function 已部署到 v9。
- Personal Synapse route 已部署，內部 RPC 只允許 service role 執行。
- `growth_control.ai_job_transition_v1` 已部署。
- `ai_jobs` 已啟用 RLS。
- ChatGPT Web / OpenCLI Worker 已完成一次真正 E2E：
  - job: `ca93f427-7e91-4766-ab62-40abe58af8d7`
  - provider: `chatgpt_web_opencli`
  - result: `Growth Brain Worker E2E OK`
  - browser readback: true
  - 結果與 result_evidence 已寫回 `ai_jobs`。

## 目前唯一主線

現在不再處理「網站有沒有部署」或「AI 能不能接通」。

目前唯一尚未完成的 V1 驗收是：

```text
正式網站真實輸入
→ 自動建立／觸發 ai_jobs
→ Worker 自動執行
→ ChatGPT 回覆
→ result / result_evidence 寫回 Supabase
→ 正式網站重新讀取並顯示同一結果
```

這條成功後，才算 V1 的網站 AI 閉環真正成立。

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
