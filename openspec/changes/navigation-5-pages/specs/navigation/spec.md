## ADDED Requirements

### Requirement: 主導覽固定為五頁
系統 SHALL 在主導覽只顯示「今天」「作品」「學習」「研究室」「收集」五項，順序固定；桌機頂部與手機底部導覽一致。

#### Scenario: 登入後看到五頁導覽
- **WHEN** 使用者開啟網站
- **THEN** 主導覽恰好顯示 今天、作品、學習、研究室、收集
- **AND** 不出現 能力庫、團隊、歷程、回顧 作為主導覽項目

### Requirement: 每頁頂部功能捷徑列
每個主頁 SHALL 在頁首下方顯示功能捷徑列，列出該頁全部分頁；點擊 SHALL 直接切換分頁，不需捲動。系統 SHALL NOT 把多個分頁內容合併成需捲動尋找的長頁。

#### Scenario: 一次點擊切換
- **WHEN** 使用者在任一主頁點擊捷徑列上的分頁
- **THEN** 內容切換為該分頁，且捷徑列仍在可視範圍內

#### Scenario: 手機捷徑列
- **WHEN** 螢幕寬度 ≤ 760px
- **THEN** 捷徑列可橫向滑動並固定在頁首下方，每個項目觸控區至少 44px

### Requirement: 隨時知道在哪、能做什麼、下一步
每個分頁 SHALL 顯示「頁名 › 分頁名」、一句白話用途，且 SHALL 只有一個主要按鈕。

#### Scenario: 位置與唯一主要按鈕
- **WHEN** 任一分頁渲染完成
- **THEN** 頁首顯示目前頁名與分頁名
- **AND** 可見的主要（primary）按鈕恰好一個

### Requirement: 系統頁收在齒輪選單
系統 SHALL 將「待處理」「AI 團隊」「系統狀態」放在右上齒輪，待處理排第一，且 SHALL NOT 出現在主導覽。

#### Scenario: 打開齒輪
- **WHEN** 使用者點右上齒輪
- **THEN** 依序顯示 待處理、AI 團隊、系統狀態

### Requirement: 回顧位於作品頁
「回顧」SHALL 是作品頁的一個分頁；能力變化 SHALL 位於學習 › 我的能力。

#### Scenario: 找到回顧
- **WHEN** 使用者打開作品頁
- **THEN** 捷徑列包含「回顧」

### Requirement: 每個現有 view 都有新位置
系統 SHALL 依 design.md 對照表把每個現有 view 搬到「新頁 › 分頁」；既有功能 SHALL NOT 被刪除。

#### Scenario: 舊 view key 導向
- **WHEN** 以舊 view key（capabilities、ceo、history、inbox、synapse、learn）開啟
- **THEN** 導向對照表中的新頁與分頁

### Requirement: 今日探索只推薦一件事
研究室 › 今日探索 SHALL 只顯示一張「AI 推薦你看的一件事」卡：一句白話說明與一個主要按鈕「看這件事」。系統 SHALL NOT 要求使用者在「保留／忽略／送進試驗」之間三選一才能繼續。

#### Scenario: 推薦卡
- **WHEN** 有推薦內容
- **THEN** 顯示一張卡、一句白話、一個主要按鈕
- **AND** 次要動作「換一件」「先收起來」為文字按鈕

#### Scenario: AI 未上工
- **WHEN** 研究任務未執行（例如 Worker 未開）
- **THEN** 卡片以白話說明原因與使用者可以做什麼

### Requirement: 術語第一次出現必附白話
介面中的專有名詞（例如 試驗、來源查證、作戰手冊、Worker）第一次出現時 SHALL 附一句白話解釋；個人頁 SHALL NOT 顯示英文眉標。

#### Scenario: 術語解釋
- **WHEN** 頁面第一次出現專有名詞
- **THEN** 同一處顯示白話解釋
