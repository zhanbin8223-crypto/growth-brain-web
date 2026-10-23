# ai-brainstorm：研究室「腦力激盪」

## Why
使用者想讓兩個以上的 AI（現在 Grok Bot，之後 GPT 經 Mac OpenCLI 或 OpenAI API，可能更多）在同一題目下互相出主意、挑毛病，並能在網站上閱讀與插話。

## What changes
- DB（growth_control，新表，無需備份）：`brainstorm_topics`、`brainstorm_messages`；RLS 本人唯讀；寫入只經 SECURITY DEFINER `brainstorm_open_topic_v1`、`brainstorm_post_v1`（service_role 與 authenticated 本人可呼叫；本人身分由 auth.uid() 決定，作者強制為 `user`）。讀取 `brainstorm_read_v1`（STABLE，任何代理通用，含 `unanswered_by_me`）與 `brainstorm_snapshot_v1`（網站用）。
- 防迴圈：每代理每主題每天 ≤ 100 則；代理發言須帶 `p_seen_last_message_id`；主題關閉後不能發言。
- Edge `growth-home`：GET `surface=brainstorm`；POST `action=brainstorm_post`（使用者插話／開主題）。
- 前端：研究室第二個分頁「腦力激盪」（W1b）：主題列表、串列（AI 名稱／頭像 chip、角色標籤、來源）、整理卡、插話與開主題表單。
- 種子：主題「數字人 IG：第一支 Reel 怎麼做」，Grok Bot 開場只引用 researcher_log 10/16–10/20 已有的發現。

## Out of scope
接 GPT 本身（金鑰／OpenCLI 尚未決定）、自動排程對話、關閉主題 UI。

## Rollback
前端 revert PR；DB：`drop function` 五個函式與兩個 wrapper，`drop table growth_control.brainstorm_messages, growth_control.brainstorm_topics`。
