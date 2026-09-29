# Growth Brain 執行入口

## 先接續，不重建

每輪先透過已授權的 Supabase 連接器讀取 `growth_control.ai_handoff_v1`，使用已核實的 person UUID 與 project_key；不要把字串 `primary-user` 當 UUID 參數。只展開目前工作包所需的資料。Supabase 是進度、政策及個人資料的正式來源；此檔是進入程式庫時的提醒，不取代即時狀態。

首讀交接已包含 `execution_recovery_policy` 及 `execution_gate_function`。按當輪實際可用的工具與技能工作，不沿用其他環境的能力假設。原生平台對技能載入與安全的要求優先。

## 遇錯必須先解決

1. 保留原始目標與驗收條件。不能把「工具成功」「改好程式」「已部署」當成完整功能成功。
2. 分類真正缺口：資料、程式錯誤、工具能力、暫時服務故障、額度、本人授權或安全拒絕。
3. 按缺口載入最小必要的相關技能，再實際使用工具；資料庫角色可使用 Supabase 及 Postgres 最佳實務，程式與部署檢查使用當輪可用的程式庫和測試工具。只登錄角色不等於已啟動獨立代理。
4. 使用最小修正，重跑失败步驟，並檢查受影響的前序功能。同一根因假設最多三次；仍无新證據就換方法或收集新證據，不原樣無限重試。
5. 方法失敗不等於任務無法執行。確認當輪能力，評估合法且有授權的替代方法；不要預設所有寫入或測試只能在 Work。
6. 明確安全拒絕、權限拒絕不可換通道繞過；不匯出登入憑證，不開新付費服務，不刪除原有證據來湊通過。
7. 做完仍可執行的驗收再收尾。真正受本人登入、外部故障或平台執行上限阻擋時，保存完成項、錯誤、已試方法、待辦與恢復點，不把暫停記為完成。

## 結束前的可執行檢查

呼叫 `growth_control.execution_recovery_gate_v1(report)`，將結果及其依據寫回工作包 evidence。report 需包含原始 goal_ref、checks、criteria_unchanged；各必要檢查需有 key、status、evidence_ref，真實驗收另有 verification_scope=real。

- `can_close=false` 不能把未驗收目標標完成。
- `diagnose`、`load_relevant_skill`、`inspect_available_tools`、`evaluate_alternative`、`repair_and_retest` 代表還有工作，不是最終報告。
- `waiting_resumable`、`paused_needs_new_evidence` 代表保留進度等待條件，不代表功能完成。
- 此函式驗證提交的結構化報告，不會自行證實外部證據，也不是背景執行器；工具紀錄與實際結果仍要人工或程式核對。

## 個人資料與成效

真實輸入、測試資料與系統建置分開。AI 產出中文卡片不等於使用者已學會；選課或自評不自動升級能力。主要介面使用繁體中文，第一次出現術語要有白話解釋。不要把個人原始對話或學習紀錄提交到公開程式庫。

## 交接

每輪留下本次實際完成、失敗及修正、驗證證據、最小剩餘卡點與下一個恢復位置，再刷新 CEO snapshot 與 AI handoff。完成目前整段可驗收工作，不無限擴張範圍，不為了通過而降低驗收條件。
