---
status: proposed
date: 2026-10-10
decision-makers: Liou Bi（使用者，待核准）
---

# 個人導覽收斂為 5 頁，系統頁移到齒輪選單

## Context and Problem Statement

現行 6 主頁＋多子頁＋3 隱藏頁，名稱重疊、學習與收集被藏起來、系統維運混在個人導覽，使用者不知道每頁要做什麼。

## Considered Options

* 維持現狀，只改視覺
* 5 個個人頁（今天／作品／學習／收集／回顧）＋齒輪系統選單

## Decision Outcome

Proposed option: 5 個個人頁＋齒輪系統選單，每頁一個目的與一個主要按鈕。完整規格見 openspec/changes/navigation-5-pages。

### Consequences

* Good：主迴圈（作品→證據→能力）在導覽上一眼可見；系統雜訊離開個人區。
* Bad：舊書籤與測試需導向／更新；一次改動範圍大，需單一 PR 並可整體回滾。

### Confirmation

openspec validate navigation-5-pages --strict 通過；實作後以 tasks.md 第 3 節驗證。
