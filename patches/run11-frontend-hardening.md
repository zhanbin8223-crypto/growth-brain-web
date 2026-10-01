# Growth Brain run11 frontend hardening patch plan

Target: app.js on canonical frontend source.
Status: prepared only; production code mutation was denied by the current runtime safety boundary.

## 1. Status styling and Traditional Chinese
- Treat `blocked_external` as danger styling.
- Map `blocked_external` to `外部服務受阻`.
- Capability panel text: `外部能力受阻，其他工作繼續`.

## 2. Remove public-facing raw technical labels
Replace user-visible:
- `data_scope=real` -> `真實資料`
- `Learning Unit` -> `學習單元`
- `Live` -> `正式資料已連線`
- `Synapse` -> `知識連結`

## 3. Signed-out knowledge-link truthfulness
Before reading or rendering graph nodes:
- loading: `正在載入知識連結…`
- signed out / no live data: `目前未讀取正式知識連結；不會用快取或示範資料冒充個人結果。`
- live but empty: `目前沒有可顯示的正式知識連結。`
- render graph nodes only when `A.liveStatus === 'live'`.

## 4. Path/artifact trial: current stage only
Do not map/render the full future-stage array.
For each mode only render:
- 目前階段
- 階段目標
- 要產出的作品
- 作品完成後：依結果與真實回饋決定繼續、轉向或停止；屆時才產生下一階段。

The UI must also state:
`目前 AI 任務執行層尚未接上，所以只顯示通用骨架，不假裝已做動態推理；試跑不寫入正式個人主線、學習證據、最近進展或個人知識連結。`

## Acceptance
1. Before a real artifact result exists, exactly one stage is visible.
2. No public-facing raw labels: `data_scope=real`, `Learning Unit`, `Live`, `Synapse`.
3. Signed-out knowledge-link view renders zero cached/demo personal nodes.
4. `blocked_external` has a clear Traditional Chinese label and danger styling.
5. Trial remains non-persistent.
