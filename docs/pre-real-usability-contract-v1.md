# Pre-real usability contract v1

This contract applies before full real-world acceptance is complete.

## Path / artifact trial
- Inputs: a topic/content item, or an already-known goal.
- Render only the current stage.
- Current stage contains one stage goal, one deliverable artifact, and one rule for deciding what happens after the artifact result.
- Do not pre-render future stages.
- Trial output is non-persistent personal state. It must not become Personal Home progress, Learning evidence, a personal route, or a personal knowledge link.
- Until the AI execution provider is connected, label the result as a generic skeleton rather than dynamic AI reasoning.

## Capability status labels
Use Traditional Chinese first:
- implemented -> 已實作
- real_acceptance_pending -> 待真實驗收
- in_progress -> 正在完善
- not_completed -> 尚未完成
- blocked_external -> 外部能力受阻

Do not map blocked_external to 尚未完成.

## Knowledge-link surface
The knowledge-link surface must distinguish:
- loading
- empty
- error
- ready

Cached or demo content must be explicitly labeled and must never look like current personal data.

## Language
Primary UI labels are Traditional Chinese. When a technical term is needed, show the Chinese explanation first and put the technical term in parentheses.

## Security boundary
The browser should use the authenticated Growth Home backend route for private data. Privileged database snapshot RPCs are not intended as direct browser APIs. Any privilege hardening must preserve the service-role backend path and be verified after deployment.

## Acceptance
Structural/development acceptance may pass without real user data. Real-world acceptance stays pending until genuine user input, artifact, action, or explicit confirmation exists.
