# Design

## 流程
1. 使用者在「作品 › 等待中」卡片、作品詳情「這件作品會驗證哪些能力」或能力圖譜空作品磚按「依完成條件產生建議清單」。
2. 前端 POST `propose_work_skills` → `work_skill_proposal_v1`（STABLE、不寫入）：讀 `personal_artifacts.done_evidence`，用 10 個能力範本的關鍵字比對每個條件，合併成清單（含對應條件編號）；已存在的清單一併回傳（existing_skills）供編輯。
3. 編輯器：改名、類型（能力／工具）、為什麼、用在哪個條件；刪除、新增。
4. 「確認儲存」→ `save_work_skills` → `work_skill_targets_save_v1`：驗證 1–10 項、名稱 2–40 字；upsert 只更新文字欄位，新列 `evidence_state='unknown'`、`ai_suggested_state='unknown'`、`confidence=0`；被移除且無證據的列刪除；寫一筆 `skill_list_confirmation` 連結記錄來源 `proposed at work creation, user-confirmed YYYY-MM-DD`。

## 為何不用 LLM
伺服器端沒有 LLM 金鑰；既有 GPT 規劃依賴 Mac Worker（目前心跳停在 10/6）。規則版可立即運作、可測、可追溯；之後若加入伺服器 LLM，只需替換 proposal 函式，確認／儲存流程不變。

## 程度對應（evidence_state → 標籤）
unknown→沒試過；exposure/acknowledged→接觸過；understood/can_explain/apply_with_help→協助下會做；apply_independently/retained→能自己做；real_project/commercialized→作品驗證。「已經會」＝接觸過以上。

## 交證據
詳情面板的「交一個證據」走既有 `record_personal_artifact_evidence`（對應條件編號取自 minimum_needed_now），只在作品為「目前作品」時可用；程度仍由既有審核流程決定。

## 安全
service wrapper `security definer` + `resolve_single_user_v1`；revoke public/anon/authenticated，只給 service_role；growth_control 內部函式 `set search_path=''`。
