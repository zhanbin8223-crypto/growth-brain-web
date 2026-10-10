# my-questions
## ADDED Requirements
### Requirement: 每件 AI 工作狀態可見
系統 SHALL 列出使用者每件真實 AI 工作的狀態、送出時間、等待時間；完成時提供結果連結。
#### Scenario: 處理程式離線
- WHEN 最後心跳超過 10 分鐘
- THEN 列表與學習／研究室橫幅顯示「處理程式離線，最後上線 M/D HH:MM」
### Requirement: 取消只限本人且不影響處理中工作
#### Scenario: 取消
- WHEN 使用者對排隊中或失敗的工作按取消並確認
- THEN 狀態變為已取消；處理中、已完成或管線型工作不可取消
### Requirement: 完成提示
#### Scenario: 有新完成
- WHEN 有晚於上次查看的完成工作
- THEN 「收集」顯示數字徽章且今天頁顯示提示；打開我的提問後清除
