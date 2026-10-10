## ADDED Requirements
### Requirement: 頭像選單是帳號與系統的入口
#### Scenario: 開啟頭像選單
- WHEN 使用者點側欄底部（手機：頂列）頭像
- THEN 顯示帳號、帳號與設定、系統各分頁、登出；按 Esc 或點外面會關閉
### Requirement: 系統數字只算失敗待重試
#### Scenario: 有 2 個失敗的提問
- WHEN my_jobs 快照有 2 筆 status=failed
- THEN 側欄系統列與手機頭像都顯示 2；排隊中不計入
### Requirement: 帳號與設定頁
#### Scenario: 已登入
- THEN 顯示信箱、登入方式（信箱連結、不用密碼）、「登出這台裝置」
