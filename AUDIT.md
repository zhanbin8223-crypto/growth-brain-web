# Growth Brain — pre-deploy audit

## 已完成
- Personal Home 與 System Cockpit 分離。
- 首頁不再直接綁 B+18 / system build step。
- System Cockpit 改為按需載入，不把完整 build payload 放進 Personal Home。
- Magic Link 改為 `create_user=false`。
- `growth-home` API 支援 `personal_home` / `system_cockpit` surface。
- 前端 JavaScript syntax 全部通過。
- static references 通過。
- forbidden secret scan 通過：未發現 service role / secret key / database password。
- 本機 static server 可正常回傳 `index.html` 與 `app.js`。

## 尚未完成
- 正式 HTTPS hosting。
- Auth redirect 綁 production origin。
- 真實瀏覽器 session persistence。
- production authenticated Personal Home GET / Learning POST。
- responsive / visual QA。

## 驗收原則
部署成功本身不是完成。只有 B+18 七個 E2E checks 真實通過，才可完成正式網站里程碑。
