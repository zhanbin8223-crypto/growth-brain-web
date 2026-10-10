---
status: accepted
date: 2026-10-10
decision-makers: Liou Bi（使用者已核准）
---

# 作品能力清單：規則範本建議 ＋ 使用者確認，不依賴 Mac Worker

## Context and Problem Statement
作品需要的能力原本由 Worker 上的 GPT 規劃產生；Worker 停擺時沒有清單，能力圖譜空白。

## Considered Options
* A. 等 Worker 恢復，沿用 GPT 規劃
* B. 伺服器端 LLM（edge function 呼叫模型）
* C. 規則／範本建議（SQL），使用者確認後儲存

## Decision Outcome
選 C。伺服器端目前沒有 LLM 金鑰，B 需要新增密鑰與成本，另案決定；C 立即可用、可測、可追溯。介面（propose → 確認 → save）與建議來源解耦，之後可換成 B 而不改確認流程。

### Consequences
* Good：不依賴 Worker；寫入一定經過使用者確認；自評不升級。
* Bad：範本只涵蓋 10 類能力，對不到的條件只給佔位名稱，需要使用者改寫。
