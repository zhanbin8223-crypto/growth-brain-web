# OpenCLI 隔離試用結果

測試日期：2026-09-30（台灣時間）。本報告只記錄實際觀察，不代表完整第二大腦或 ChatGPT 後端已接通。

## 決策

OpenCLI 1.8.8 通過「公開資料擷取工具」的第一輪試用，可保留為受控收集器候選；尚不採用為 ChatGPT 網頁版運算後端。nanobot 僅完成來源與模型依賴審查，沒有安裝，也沒有測試其推理。維持目前 Growth Brain 主線，不替換資料庫或整套執行架構。

## 執行證據

- 測試分支：`trial/opencli-evaluation-20260930`；沒有修改 `main`、正式頁面、登入設定。
- GitHub Actions 執行： https://github.com/zhanbin8223-crypto/growth-brain-web/actions/runs/36622740711
- 執行 commit：`af1b1b9152cfa6ecb247e3e769c8800ca4354980`。
- 工作：`public-read-and-boundaries`；job ID `109591967714`；結果 `success`。
- 環境：Ubuntu 24.04.5、Node 22.23.2、npm 10.9.8。
- 安裝：`@jackwener/opencli@1.8.8`，使用 `--ignore-scripts`，未執行套件安裝後自動腳本。沒有把模型金鑰、使用者登入憑證或資料庫密鑰傳給測試工作。
- 安裝依賴鎖定檔 SHA-256：`4df3ee632e36f96e0d44c3ec6a354a5a626a8711d3bd085d3085dc01fdb37b9d`。此次只記錄鎖定檔摘要，尚未保存整份依賴鎖定檔，因此不宣稱未來重跑具有完全相同的間接依賴。

## 已測到的能力

1. 版本啟動、命令清單讀取成功。
2. 從實際命令清單確認 Hacker News 公開讀取功能，且不需要瀏覽器。
3. 命令清單存在 ChatGPT 的 ask/read/status 等功能；這只證明有指令，沒有證明能登入或推理。
4. 執行 `opencli hackernews top --limit 3 -f json`，取得 3 筆當時的真實公開紀錄。Hacker News ID：49896586、49896712、49898877；擷取時間 2026-09-29T19:56:21.401411+00:00。文章主張本身未在此試驗查核。
5. 使用本次測試新增的轉接程式保留原始回傳、來源網址、時間與內容摘要值。同一批資料重放兩次仍保留 3 筆。這是測試轉接程式的行為，不是宣稱 OpenCLI 原生提供 Growth Brain 去重。
6. 測試輸出標為 `data_scope=validation`、`subject_scope=external`、`user_confirmed=false`、`inference_performed=false`，沒有把熱門文章當成使用者興趣或已學會的知識。

## 已接既有收件介面驗證

將上述 3 筆實際公開紀錄，透過 Supabase 既有 `growth_control.inbox_capture_v1` 做受控交易測試。驗證原始紀錄、來源網址、測試分類全部保留；個人進展不變；測試後整批回滾，殘留 0 筆。這是資料介面整合驗證，並非 OpenCLI 自動直接連上正式 Supabase，也不算真實使用者成果驗收。

## 抓到的陷阱與處理

`opencli doctor` 這次 exit code 為 0，但內文同時回報：

```text
[MISSING] Extension: not connected
[FAIL] Connectivity: failed (Browser Bridge extension not connected)
```

因此不能以程式結束碼 0 判定瀏覽器已連通。新增 `readiness_guard.py` 作為本專案的保守判定，缺依賴直接拒絕；沒有實際成功瀏覽器操作證據則維持未驗證。6 個本機結構測試通過，包含本次觀察到的錯誤成功狀態。正向案例是測試樣本，不是實際瀏覽器連線。

## 尚未驗證

- 使用者 Mac / Chrome 的擴充套件、持續登入與重新連線。
- ChatGPT 網頁推理、長回答完成判斷、額度限制與網站改版耐受性。
- 任意網站或多來源普遍可用性；目前只完成一個公開來源的即時讀取。
- nanobot 安裝、模型連接、長期記憶与執行品質。
- 正式 Supabase 自動寫入、跨程序去重、端到端學習成果。

## 下一個最小驗收

沿用已完成的收件匣路由，先把一筆來源明確、由使用者確認要學的內容交給現有助手處理，再保存一張有來源的中文學習卡。保持正式成果和測試紀錄分離。不要為此先安裝第二套代理框架；不要因 ChatGPT 指令存在就把訂閱視為可任意調用的 API。

## 審查來源

- OpenCLI 自帶使用技能： https://github.com/jackwener/OpenCLI/blob/main/skills/opencli-usage/SKILL.md （本次讀取 blob `3a9e8f9e8a661cb813d67877e45f0ed6b046af59`）。
- OpenCLI ChatGPT 文件： https://github.com/jackwener/OpenCLI/blob/main/docs/adapters/browser/chatgpt.md
- nanobot 模型設定： https://github.com/HKUDS/nanobot/blob/main/docs/providers.md （blob `459443262e6405b8fb4ff3077b0dc4629f8176ac`）。它仍然需要模型提供者或本地模型，安裝框架本身不提供推理能力。
- OpenAI ChatGPT/API 計費與方案限制應以官方文件及帳戶顯示為準；這次模型請求為 0，未執行 ChatGPT 網页自動擷取。
