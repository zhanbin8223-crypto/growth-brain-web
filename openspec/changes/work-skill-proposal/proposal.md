# Change: work-skill-proposal（作品需要的能力：系統建議 → 使用者確認）

## Why
作品建立後沒有「需要哪些能力」清單，能力圖譜就是空的；過去清單靠 Mac Worker／GPT 規劃產生，Worker 停擺時整條斷掉。

## What Changes
- 新增不依賴 Mac Worker 的流程：作品（新建或既有但沒有能力）→ 系統依完成條件提出建議清單 → 使用者在作品詳情確認／修改 → 才寫入 `artifact_skill_targets`。
- 建議方式：**規則／範本對應（rule_template_v1）**。伺服器端目前沒有 LLM 金鑰（growth-home edge function 只讀 Supabase 金鑰），所以不呼叫 AI 模型；對不到範本的條件會產生「完成『條件』需要的能力」佔位項，請使用者改寫。
- 能力圖譜改為 capmap-ab2：依作品分組、每列＝名稱＋一個程度標籤、兩件都用到標記、篩選（全部／我已經會的／還沒會的）、頁面唯一主按鈕「去補這一項」、點能力開詳情（交證據＋我可能會）。A1 深色風格只套用在此頁。
- 「我可能會」= 待確認自評，存在既有 `artifact_context_links.metadata`（link_kind `skill_self_claim`），**不改程度**。

## Impact
- DB：`growth_control.work_skill_proposal_v1`(STABLE)、`work_skill_targets_save_v1`、`skill_self_claim_v1`、3 個 service wrapper（只授權 service_role）；`artifact_context_links` link_kind 增加 `skill_self_claim`、`skill_list_confirmation`；`capability_library_snapshot_v1.personal_skills` 增加 `skill_kind`、`minimum_needed_now`、`self_claim`（只加欄位）。
- Edge：growth-home 新增 POST action `propose_work_skills`、`save_work_skills`、`claim_skill`（v18）。
- 前端：`capmap.js`、`capmap.css`、`app.js`（能力圖譜、作品詳情、等待中分頁入口）、`adapter.js`。

## Forbidden scope
- 不自動寫入建議；不因自評、AI 建議或儲存清單而提升 `evidence_state`。
- 移除清單項時，已有證據的能力不刪除（回報 kept_with_evidence）。
- 不改其他頁面風格。

## Rollback
- 前端：revert 此 PR。Edge：重新部署 v17 原始碼（repo main 版本）。
- DB：`drop function` 新增的 6 個函式；恢復 link_kind check 舊清單（需先刪除新 kind 的列）；capability snapshot 以 main 版 mirror 重建。
- 資料：`growth_control.artifact_skill_targets_backup_20261010_ws`、`artifact_context_links_backup_20261010_ws`。
