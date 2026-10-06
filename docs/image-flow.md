# Conditional images: explicit ChatGPT handoff

## Scope and capability decision — 2026-10-07

Allowed edit: isolated system image queue, role output contract, asset import/reference/QA, authenticated System Cockpit image status and related tests. Read only: existing personal artifacts/skills/routes and their evidence; resident Worker, its unfinished local changes and credentials. Excluded: worker restart, broad UI redesign, new paid API, personal evidence promotion. Contract impact: new design/visual/frontend/ux/image_need system or validation jobs must return JSON containing `image_request`. Existing completed jobs and unrelated job types retain their behavior.

Live `ai_handoff_v1`, skill/resource registries, current GitHub main and local OpenCLI 1.8.8 were inspected. Registry advertised only text/JSON chat capabilities. Local OpenCLI includes `chatgpt image` and file export code, but this is not evidence of reliable execution: doctor reports CLI 1.8.8 versus daemon 1.8.6, resident heartbeat is stale, and the current Worker claims arbitrary pending jobs and completes them from text. No autonomous image job is enabled. `image_generation` is rejected in the text queue instead of silently completing a prompt as an image. No daemon/Worker restart was performed.

The actual supported route is:

1. A design role decides whether imagery is needed. No image is the default when text, data, existing images or native diagrams suffice.
2. A new relevant system job receives the versioned Visual DNA and a required `image_request` output contract. A completed role response is validated and captured transactionally into `growth_control.image_requests`. Malformed/absent decisions fail the transition; they cannot imply an image was produced.
3. `image_required:false` records `skipped`. If a picture is needed, retain `reason`, `existing_asset_review`, `prompt`, `placement`, `aspect_ratio`, complete `visual_dna`, `purpose:illustration`, and `is_real_evidence:false`. Keep `awaiting_generation` until a real file is imported. If an existing image fits, import it with `source:existing_asset`; do not call a generator.
4. If no existing asset fits, a Codex/ChatGPT operator reads the private brief and reference images, invokes the built-in ChatGPT image generation tool, inspects the actual result and imports it. The website and text Worker do not call that tool. An API key is not required for this handoff. The operator must record a real tool/conversation reference; never invent provenance.
5. Import PNG/WebP bytes to a content-addressed `assets/generated/` file. Validate magic bytes, dimensions, size, ratio, source and DNA; state becomes `asset_ready`. This is not image QA or task completion.
6. Inspect desktop/mobile layout, decode, style and truthfulness. Stage a public manifest reference only after this local review, deploy, then inspect the signed-in production page. `complete` fetches production bytes and manifest and checks exact hashes before recording QA. Missing/failed evidence leaves the request incomplete.

`awaiting_generation → asset_ready → completed`; QA failure becomes `qa_failed`, requiring correction/review. Matching repeated request/attach/QA operations are idempotent; a reused request key with changed content fails. RPC/network ambiguity: read the authoritative request with `get`/`list` before retrying; never regenerate an image merely because an acknowledgement was lost.

## Visual DNA and truth boundaries

`assets/visual-dna.json` preserves the existing warm paper, amber, sage and gentle story illustration world. It is mirrored exactly in `growth_control.image_policy`. Prompt and asset must carry that version. A style change requires deliberate review of both, not arbitrary generation-time rewriting. Reference images remain in `assets/ui/`.

Allowed placements: today hero, projects hero/cover, team hero, history hero. These are decorative illustrations with empty alt and `aria-hidden`; no generated image can become a result screenshot, completed work, mastered skill, testimonial or revenue evidence. The manifest excludes private prompt, rationale, person ID and generation URLs. Existing fallback images remain usable if a manifest/file is unavailable.

## Operator commands

Run from the repository root. Load only the existing local private environment; never paste secrets into chat or public files:

```sh
set -a
source ~/.config/growth-brain/worker.env
set +a
node scripts/image-flow.mjs list
node scripts/image-flow.mjs request /private/tmp/brief.json stable-request-key
node scripts/image-flow.mjs brief REQUEST_ID /private/tmp/image-handoff.txt
# Invoke built-in ChatGPT image generation only after the need/reuse decision.
node scripts/image-flow.mjs attach REQUEST_ID /absolute/generated.png chatgpt_image_generation 'actual-tool-or-conversation-reference'
# For reuse, use source existing_asset and the existing source path instead.
node scripts/image-flow.mjs stage REQUEST_ID /private/tmp/review.json
# Deploy the changed asset + manifest + code, inspect the production page.
node scripts/image-flow.mjs complete REQUEST_ID /private/tmp/review.json
node scripts/image-flow.mjs fail-qa REQUEST_ID 'specific failed check'
```

Review JSON requires `asset_sha256`, `visual_dna_id`, `local_decode`, `style_consistent`, `no_false_evidence`, `placement_correct`, `desktop_pass`, `mobile_pass`, `reviewer`, `review_ref`. Completion additionally requires `production_url` (canonical HTTPS), `production_sha256`, `production_decode`. Boolean checks must be backed by actual inspection. Database validation checks report structure; it cannot independently verify screenshots or the reviewer's judgement. The CLI verifies served bytes/reference; browser review verifies actual rendering.

Only the privileged service RPC can mutate this queue, after resolving the existing verified single user. Tables use RLS, no direct anon/authenticated grants; RPC execute is service-role only. The existing authenticated System Cockpit wrapper exposes the private queue to the verified user. No new identity, public prompt endpoint or credential exposure is introduced.

## Validation

Tests were written before implementation: Node suite failed on missing module; SQL rollback suite failed on missing image policy. Implemented tests cover need=false, missing/wrong fields, DNA mismatch, fake file, aspect mismatch, private manifest leakage, unsafe HTML, lifecycle, duplicate/conflicting requests, false evidence, QA without an asset, stale/failed production checks, authorization, employee result capture, and idempotent attach/QA. The first SQL rerun caught a missing insert value; it was corrected and rollback tests passed.

```sh
node --test validation/*.test.mjs
node scripts/check-image-manifest.mjs
# Execute validation/image-flow-rollback.sql through the authorized SQL connector.
```

Local browser: main today page and synthetic status fixture inspected on desktop and 390×844; no horizontal overflow; image decoded; handoff expanded and readable. The real asset roundtrip deliberately reuses `home-hero-workspace.webp` with truthful existing-asset provenance. This verifies import/reference/QA without generating unnecessary artwork. It does not prove autonomous OpenCLI generation or a new image-generation run.

The existing PRODUCT.md predates the current Impeccable schema; its documented product behavior was preserved. Optional `impeccable init` can refresh that document separately.
