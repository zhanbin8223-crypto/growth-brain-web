## ADDED Requirements

### Requirement: 個人主導覽固定為五頁
系統 SHALL 在個人主導覽只顯示「今天」「作品」「學習」「收集」「回顧」五項，順序固定；桌機頂部導覽與手機底部導覽一致。

#### Scenario: 登入後看到五頁導覽
- **WHEN** 使用者登入並開啟網站
- **THEN** 主導覽恰好顯示 今天、作品、學習、收集、回顧 五項
- **AND** 不出現 能力庫、研究室、團隊、歷程 等舊主頁名稱

#### Scenario: 手機底部導覽
- **WHEN** 螢幕寬度 ≤ 600px
- **THEN** 底部導覽顯示同樣五項，且每項觸控區至少 44px

### Requirement: 系統頁收在齒輪選單
系統 SHALL 將「待處理」「AI 團隊」「系統狀態」放在右上齒輪選單，且 SHALL NOT 出現在個人主導覽。

#### Scenario: 打開齒輪
- **WHEN** 使用者點右上齒輪
- **THEN** 顯示 待處理、AI 團隊、系統狀態 三項
- **AND** 待處理排在第一項

### Requirement: 每頁一個目的與一個主要按鈕
每個個人頁 SHALL 只有一個主要（primary）按鈕：今天＝「開始這一步」或「選這件開始」、作品＝「交出證據」、學習＝「送出練習」、收集＝「＋ 收集」、回顧＝「看本週」。

#### Scenario: 主要按鈕唯一
- **WHEN** 任一個人頁渲染完成
- **THEN** 該頁可見的 primary 樣式按鈕恰好一個

### Requirement: 每個現有 view 都有新歸屬
系統 SHALL 依 design.md 對照表把每個現有 view 搬到新頁或齒輪選單；任何既有功能 SHALL NOT 被刪除。

#### Scenario: 舊 view key 導向
- **WHEN** 以舊 view key（capabilities、research、ceo、history、inbox、synapse）呼叫 setView 或開啟舊連結
- **THEN** 導向對照表中的新頁（必要時展開對應區塊）

#### Scenario: 功能不遺失
- **WHEN** 比對改版前後的功能清單
- **THEN** 改版前每個子頁的功能都能在新頁或齒輪選單找到

### Requirement: 不顯示英文眉標
個人頁 SHALL NOT 顯示 TODAY、ARTIFACTS、LAB 等英文眉標。

#### Scenario: 頁首只有中文
- **WHEN** 開啟任一個人頁
- **THEN** 頁首不含全大寫英文眉標
