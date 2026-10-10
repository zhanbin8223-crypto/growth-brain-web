---
status: proposed
date: 2026-10-10
decision-makers: Liou Bi（使用者，需求已確認修訂版，待核准實作）
---

# 主導覽 5 頁（今天／作品／學習／研究室／收集）＋每頁頂部功能捷徑列，系統頁移到齒輪

## Context and Problem Statement

現行 6 主頁＋多子頁＋3 隱藏頁，名稱重疊、學習與收集被藏、系統維運混在個人導覽；今日探索術語多、停在三選一沒有下一步。使用者常不知道在哪、能做什麼、下一步是什麼。

## Decision Drivers

* 不把功能硬併成長頁；每頁所有功能一眼可見、一點即達
* 研究室要保留給 AI 研究代理自由探索
* 每個分頁一個主要按鈕；術語必有白話

## Considered Options

* A. 5 頁含「回顧」、研究室併入收集（前一版提案）
* B. 5 頁含「研究室」、回顧成為作品頁分頁、每頁頂部捷徑列（使用者修訂）

## Decision Outcome

Proposed option: B。回顧放在作品頁，因為真實紀錄大多是作品證據，看完回顧可直接交證據；能力變化放學習 › 我的能力。
研究室未來可能由 AI 研究代理經營自己的個人網站，列為 future scope，本次不做。
完整規格：openspec/changes/navigation-5-pages。

### Consequences

* Good：位置、功能、下一步固定可見；系統雜訊離開個人區；研究室有獨立空間。
* Bad：舊書籤與測試需導向／更新；改動範圍大，需單一 PR 並可整體回滾。

### Confirmation

openspec validate navigation-5-pages --strict 通過；實作後依 tasks.md 第 3 節驗證。
