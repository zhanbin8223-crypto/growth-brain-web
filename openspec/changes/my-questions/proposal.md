# Change: my-questions（我的提問：AI 工作狀態看得到）

## Why
提問／研究／學習解釋都排進 `ai_jobs`，只有 Mac Worker 處理；Worker 自 10/6 20:22 離線，使用者看不出排到哪、等多久、會不會完成。

## What Changes
- 「收集 › 我的提問」（放收集：都是「我丟進來、等處理」的東西，與收件匣同類；不另開主頁，維持五區 ADR-0002）。
- 每件：狀態 排隊中／處理中／完成／失敗／已取消、送出時間、已等／花了多久、等待原因、完成後「看結果」連結。
- 處理程式離線判定：最後心跳 > 10 分鐘＝離線，顯示「處理程式離線，最後上線 …」，不採用心跳表上過期的 `online`。學習與研究室的工作橫幅同樣顯示。
- 重試：只用既有機制（學習 `enqueue_learning_ai`、研究室 `event_lab retry`）。取消：新函式，本人、僅 pending/failed、管線型工作不可取消。
- 站內提示：有新完成的提問時，「收集」導覽顯示數字徽章＋今天頁頂部提示；看過列表即清除（localStorage）。
- 樣式：W1b 柔和卡片，只作用在 `.mq-w1b`。

## Impact
- DB：`growth_control.my_jobs_snapshot_v1`(STABLE)、`my_job_cancel_v1`、service wrapper 2 個（只 service_role）。不改資料、不取消任何既有工作。備份 `ai_jobs_backup_20261010_myq`。
- Edge growth-home v19：GET surface `my_jobs`、POST `cancel_job`。
- 前端：`myjobs.js`、`myjobs.css`、app.js（收集分頁、學習橫幅、徽章輪詢 60 秒）、event-lab.js（離線文案）、adapter.js。

## Not in scope
伺服器端 AI 處理（待使用者提供 AI 金鑰，另案 b）。

## Rollback
revert PR；edge 重新部署前一版；`drop function` 4 個新函式。
