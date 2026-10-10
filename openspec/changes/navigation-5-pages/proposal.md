# 變更提案：導覽收斂為 5 個個人頁（navigation-5-pages）

狀態：proposed（待使用者核准後才實作）　決策紀錄：docs/decisions/0002-navigation-5-pages.md

## Why
現行主導覽有 6 個主頁（今天、作品、能力庫、研究室、團隊、歷程）、多個子頁與 3 個隱藏頁（收件匣、學習、知識連結圖）。
同一件事有多個名字、核心功能（學習、收集）被藏起來、個人頁與系統維運混在一起，使用者不知道每頁要做什麼。

## What Changes
- 個人主導覽固定為 5 頁：今天／作品／學習／收集／回顧；每頁一個目的、一個主要按鈕。
- 系統維運（待處理、AI 團隊、系統狀態）移到右上齒輪選單，不出現在個人導覽。
- 每個現有 view 都有明確的新歸屬（見 design.md 對照表），不刪除資料與後端。
- 移除英文眉標（TODAY / ARTIFACTS / LAB 等）。

## Scope
- 只改前端導覽結構、頁面歸屬、頁首文案與主要按鈕。
- 不改 Supabase schema、RPC、Edge Function、資料內容；不改 Today 頁已上線的版面（PR #2）。

## Forbidden scope
- 不得刪除任何 view 的功能，只能搬家或改成同頁篩選／展開區。
- 不得把系統頁放回個人主導覽。
- 不得為了導覽改動學習、證據、能力的判定規則。

## Impact
- 前端：index.html（導覽）、app.js（setView 與各 render 函式的掛載點）、styles.css。
- 測試：validation/ 下所有依賴 data-view 名稱的測試需同步更新。
- 舊連結：舊 view key 需 redirect 到新頁（見 design.md）。

## Rollback
單一 PR 實作；回滾＝ revert 該 PR 並重新部署 GitHub Pages。因不涉及資料或 schema，無資料回滾需求。
