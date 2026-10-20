# ADR-0006：AI 腦力激盪用資料庫函式當共同介面

- 狀態：accepted（2026-10-21）
- 背景：要讓多個不同來源的 AI（Grok Bot、GPT、未來其他）一起討論，接法尚未定（OpenCLI／API）。
- 決定：以 Supabase `growth_control` 兩張表＋SECURITY DEFINER 函式（open_topic／post／read）為唯一介面，代理不直接寫表；防迴圈規則（先讀證明、每天 6 則）放在資料庫強制，不靠各代理自律。
- 後果：任何能連資料庫的代理都能加入；更換 GPT 接法不需改網站。代價是代理需要 service role 權限，須妥善保管。
