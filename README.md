# Growth Brain Web — pre-deploy candidate

這個 repository 是 Growth Brain 前端唯一 source of truth。從這裡開始，不再以 v5/v6 ZIP 作為正式版本來源。

## 目前產品結構

- **Personal Home**：個人方向、單一下一步、成功證據、Learning Support、Synapse highlights。
- **Learning Companion**：中文理解、候選 evidence 作答與伺服器 review。
- **Synapse**：首頁只看 highlights；完整 typed relation graph 在專頁展開。
- **System Cockpit**：B+18、部署、Work queue、技能員工與系統 blockers。建置資訊不再成為 Personal Home CTA。

## Auth / data boundary

- single-user private。
- Magic Link 只允許既有帳號：`create_user=false`。
- 瀏覽器只有 Supabase publishable key；service role / secret 只存在伺服器端。
- `growth-home` Edge Function 驗證 user JWT，再以 service-side RPC 取得授權後 surface。
- `GET ?surface=personal_home` 是預設首頁資料。
- `GET ?surface=system_cockpit` 只在系統頁按需讀取。
- `POST action=submit_attempt` 建立 Learning Companion candidate submission，不自動升級 learning state。

## 尚未宣稱完成

- 正式 HTTPS hosting 尚未建立。
- Supabase Auth Site URL / redirect allowlist 尚未綁正式 origin。
- reload / close-reopen session persistence 尚待真實瀏覽器驗收。
- authenticated Personal Home GET / Learning POST 尚待 production E2E。
- 視覺與 responsive 仍需真實 browser QA。

## 本機預覽

```bash
python3 -m http.server 8766
```

本機預覽只用於開發，不算正式網站或 B+18 驗收。
