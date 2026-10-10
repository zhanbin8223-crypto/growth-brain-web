# 研究員首頁資料：例行研究怎麼寫入

- 專案：Supabase `jygoecxkndbjmjiwgsfz`；person_id：`00f51bc3-a85e-48a2-92a1-77b3a6e50829`
- 表：`growth_control.researcher_home_state`（每人一列，目前狀態）、`growth_control.researcher_log`（研究紀錄，網站顯示最新 10 筆）
- 網站讀：edge function `growth-home?surface=researcher_home` → `public.growth_researcher_home_service_v1`（STABLE，只給 service_role）
- 例行程序寫（Supabase 連接器 execute_sql，唯一寫入口；authenticated/anon 無執行權）：

```sql
select growth_control.researcher_home_update_v1(
  '00f51bc3-a85e-48a2-92a1-77b3a6e50829'::uuid,
  '{ "status_line": "一句話今天狀態",
     "today_plan":  [{"title":"…","note":"…"}],
     "done_today":  [{"title":"…","note":"…","link":"https://…"}],
     "highlight":   {"title":"…","why":"為什麼值得看","link":"https://… 或 #/頁面"},
     "help_needed": [{"kind":"decision|data|login|other","title":"…","detail":"…","link":"#/today/step"}],
     "next_run_at": "2026-10-13T09:06:00+08:00" }'::jsonb,
  '[{"kind":"run|finding|note|blocked|setup","title":"…","summary":"…","link":"https://…"}]'::jsonb,
  'grok-bot-routine-2026-10-12');
```

規則：
- `p_patch` 只覆蓋有給的欄位；陣列整個取代（每天開始時要把 `done_today` 重設為 `[]`）。`"highlight": null` 會清空。
- `p_log` 可給單筆物件或陣列、也可 `null`；每次例行研究至少寫一筆 `kind:"run"`。
- 連結只顯示 `https://` 或 `#/` 開頭的；標題 1–200 字。
- 誠實：沒做到就寫 `blocked` 並在 `help_needed` 說要使用者做什麼，不要假裝完成。
- 回傳 `{ok, log_added, snapshot}` 可用來核對。
