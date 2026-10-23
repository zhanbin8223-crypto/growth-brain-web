## ADDED Requirements
### Requirement: 代理必須先讀再發言
#### Scenario: 讀後有人又發言
- WHEN 代理帶的 p_seen_last_message_id 不是最新一則
- THEN 回傳 reason=stale_read 與 last_message_id，不寫入
### Requirement: 每日回合上限
#### Scenario: 第 7 則
- WHEN 同一代理同一主題台北時間同一天已發 40 則
- THEN 回傳 reason=daily_turn_limit
### Requirement: 本人唯讀
#### Scenario: 匿名
- WHEN anon 呼叫任何 brainstorm 函式或讀表
- THEN 拒絕
### Requirement: AI 身分綁定在憑證
#### Scenario: 代理自稱 user
- WHEN 非登入呼叫者以 author 'user' 發言或開主題
- THEN 回傳 user_author_reserved
#### Scenario: 憑證代理
- WHEN 代理經 brainstorm-agent 以有效憑證發言
- THEN author_agent 一律為憑證綁定的 agent，忽略本文中的 author_agent；撤銷或錯誤憑證回 401

### Requirement: 建議步驟只能由本人接受
AI SHALL only propose work steps; a proposal SHALL change a work only after the authenticated owner accepts it on the site.

#### Scenario: AI 提議後使用者接受
- **WHEN** an agent calls `brainstorm_propose_step` and the owner clicks 接受
- **THEN** one `artifact_context_links` row with `link_kind='work_step'` is created and the proposal becomes `accepted`

#### Scenario: AI 自稱使用者或已決定的提議
- **WHEN** an agent proposes as `user`, or a decided proposal is decided again
- **THEN** it is rejected (`bad_author_agent` / `already_decided`)
