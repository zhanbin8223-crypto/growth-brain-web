---
status: accepted
date: 2026-10-10
decision-makers: Liou Bi（使用者）
---

# 主作品改為「單一商品分潤」與「數字人 AI 的 Instagram 帳號」，放棄「3 支內容」

## Context and Problem Statement

Supabase 中目前作品為「3 支內容 × 真實流量 × 變現方向驗證」（artifact 27b7add4），但使用者實際在做的是兩件事：單一商品分潤、數字人 AI IG 帳號。系統顯示的作品與現實不符。

## Considered Options

* 保留 27b7add4 為目前作品
* 改為兩件真實作品，舊作品標記 abandoned（不刪除）

## Decision Outcome

Chosen option: 改為兩件真實作品，因為系統必須反映真實在做的事。

* 27b7add4 → status=abandoned，保留歷史。
* 新候選：066f0e27「單一商品完整分潤流程驗證」、204b53ce「數字人 AI 的 Instagram 帳號」（目標沿用候選路線 b902dc11），皆掛在已選定路線 963073d2。
* 不由 AI 設定 current；由使用者在 Today 頁「選這件開始」決定（B+20 驗收項 1）。

### Consequences

* Good：Today 頁與作品頁反映真實工作。
* Bad：兩件的完成條件為草擬，需使用者確認或調整。

### Confirmation

personal_artifacts_snapshot_v1 回傳 current=null、candidates 2 件；備份表 personal_artifacts_backup_20261010_realign。

## More Information

證據：work_packages.logic-core-loop-v1.evidence.today_two_works_20261010；PR #2。
