# UI usability runtime contract v3

This contract is system/development metadata only. It does not claim real-user acceptance or create personal progress.

## Required production behavior

1. Path/artifact trial renders exactly one current stage at a time.
   - Inputs: "看到一個內容／主題" or "已有一個目標".
   - Output: current candidate direction, current stage goal, one deliverable artifact, and the decision rule after the artifact.
   - Future stages stay hidden until an artifact result or real feedback exists.
   - Before the AI execution layer is connected, label output as a generic artifact skeleton and do not imply dynamic AI reasoning.

2. Traditional Chinese terminology is the default UI.
   - Synapse -> 知識連結
   - Learning Unit -> 學習單元
   - data_scope=real -> 正式個人資料
   - live -> 已連線
   - blocked_external -> 外部能力受阻

3. Capability status mapping is distinct.
   - implemented -> 已實作
   - implemented + real acceptance pending -> 已實作，待真實驗收
   - current -> 正在完善
   - not started -> 尚未完成
   - blocked_external -> 外部能力受阻

4. Knowledge-link surface must not let cached/demo content impersonate real personal data.
   - loading: show loading state.
   - empty: say that no real personal links are available yet.
   - error: show retryable error without demo substitution.
   - ready: only after an authenticated real-source response.
   - Until the authenticated personal_synapse route is connected, show a clear "正在完善／尚未接入正式資料" state instead of a demo graph.

## Security boundary

The authenticated browser should read personal knowledge links only through the private backend surface. Browser code must not receive service-role credentials or arbitrary person_id access.

The existing service wrapper `public.growth_personal_synapse_snapshot_service_v1(auth_user_id)` is the intended backend entrypoint for a future `growth-home?surface=personal_synapse` route.

## Validation

Development validation may use structural checks or rollback-only data. Real acceptance remains pending until genuine user input/artifact/action is observed. Validation/system output must not become personal Learning evidence, Recent Progress, personal route, or personal Synapse.
