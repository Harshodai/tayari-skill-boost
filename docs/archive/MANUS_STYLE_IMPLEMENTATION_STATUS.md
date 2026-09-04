# Job Tayari: Manus-Style Implementation Status

**Audited branch:** `main` at `d1c1204c1207cf97564c04bc2352c00c676c53b7`  
**Working-tree policy:** Direct edits only. No commit or push was created.  
**Status date:** 12 August 2026

> **Bottom line:** Job Tayari now has stronger truthfulness, candidate-consent, approval, and multi-agent review foundations. It is **not yet** a live Manus-style browser computer or a complete autonomous application platform. The UI now says that honestly, rather than simulating capability.

## Direct answers

| # | Question | Honest answer | Current readiness | What must happen before a 10/10 claim |
|---|---|---|---:|---|
| 1 | Is the platform professional and easy to adopt? | **Improving, but not 10/10 yet.** The public language, empty states, safety framing, and capability labels are now substantially clearer. The product still needs a coherent design system pass, task-first information architecture, accessibility audit, and real worker states. | **7/10** | Put the candidate’s next decision first, remove remaining technical jargon, use consistent visual hierarchy, and verify all responsive and accessibility states. |
| 2 | Does the resume optimizer work with a resume, pasted JD, JD link, and custom instructions? | **The product path exists:** resume upload/paste, pasted description, public URL import, and custom-instruction forwarding are implemented. The UI now shows JD provenance and asks the candidate to review the imported text. It is **not fully proven across live job sites and model failures**. | **7.5/10** | Add deterministic integration tests for pasted/JD-link/custom-instruction payloads, source extraction fallbacks, model output provenance, and human truth-review outcomes. |
| 3 | Does onboarding and editing handle job change versus domain change? | **Yes, materially, but not deeply enough.** Career-transition fields are collected and editable. The next required improvement is a versioned transition plan that changes matching, gap analysis, portfolio evidence, and interview preparation based on the transition type. | **8/10** | Implement separate roadmaps and evidence plans for `job_change`, `domain_change`, `level_change`, `location_change`, and `return_to_work`. |
| 4 | Is there a Manus-like computer with sandbox, safety, profile, and browser connectivity? | **No—not live.** The control room is now explicitly marked as a preview. It does not connect to a browser, use credentials, fill forms, or submit. This is correct product behavior until a real isolated worker and event stream exist. | **4/10** | Build an isolated browser worker, authenticated run stream, visible URL/events/evidence, pause/stop controls, policy allowlist, sensitive-question handoff, and receipt verification. |
| 5 | Can a dream-company pipeline discover jobs, tailor a resume, get approval, and apply in a sandbox—including new jobs? | **Not end to end today.** The code can prepare/review work and preserve explicit safety boundaries. It does not yet deliver a verified Google-or-any-company monitoring-to-browser-to-receipt pipeline. | **5/10** | Build permitted-source watchers, job freshness/deduplication, hash-bound approval, real browser assistance, candidate-controlled final action, and verified external receipts. |
| 6 | Is Omnisave like Omnisave AI with Substack/Medium/LinkedIn saved-post connections, tagging, Q&A, and citations? | **Partially.** It imports public URLs a candidate pastes, organizes sources, and exposes cited answers. It **does not** currently connect to or enumerate saved-post lists from Substack, Medium, or LinkedIn. | **6/10** | Add only authorized account integrations or official user-export importers, source ownership controls, grounded-answer evaluation, and retention/deletion controls. |
| 7 | Does Gmail work and read only what the interview board needs? | **Partially.** OAuth and interview-focused processing exist, but `gmail.readonly` is a broad read-only mailbox permission, not an inherently mailbox-limited scope. Current messaging now explains this truth. | **7/10** | Enforce candidate-visible query and time window server-side, disclose retention, provide disconnect/deletion, prove filter behavior in tests, and minimize retained content. |
| 8 | Can Manus ask ruthless questions and answer only those? | **Yes.** The DeepSeek brief contains fifteen launch-blocking questions. They are not cosmetic strategy prompts; each maps to a release gate or a server-side control that must be evidenced before a 10/10 claim. | **10/10 as a governance mechanism** | Require a written, test-linked answer to every question before enabling broad browser-assisted workflows. |

## Changes made directly in the working tree

| Area | Files changed | Result |
|---|---|---|
| Truthful product claims | `src/pages/Landing.tsx`, `src/pages/ResumeUpload.tsx`, `src/pages/Omnisave.tsx` | Public copy now distinguishes implemented URL import, review, and citations from unimplemented account synchronization or autonomous execution. |
| Candidate safety visibility | `src/components/TayariComputerControlRoom.tsx`, `src/components/GmailConnectModal.tsx` | The computer shows an honest preview/offline state and required safety sequence. Gmail messaging discloses the practical implications of read-only mailbox scope. |
| Application-state integrity | `backend/go/internal/api/routes_mvp.go`, `backend/go/internal/api/routes_review_queue.go`, `backend/go/internal/api/routes_mvp_status_test.go` | Generic updates cannot falsely upgrade an application to `applied` without a recognized submission mode and existing submission record. Review-queue status is candidate-confirmed rather than externally verified. |
| Executable multi-agent review | `backend/python/app/a2a/agent_squad.py`, `backend/python/app/tests/test_agent_squad.py` | The squad now invokes the real optimizer and truth gate, fingerprints artifacts in audit events, fails closed, requires candidate approval, and always returns `submission_permitted: false`. |
| Endpoint contract | `backend/python/app/api/adaptations_routes.py` | `/api/v1/adaptations/squad-run` explicitly documents review-only behavior and returns `400` for missing required text instead of an unhandled value error. |
| Delivery brief | `DEEPSEEK_COPY_PASTE_PROMPT.md` | A copy-paste engineering brief defines the architecture, state machine, agent boundaries, release gates, validation commands, and ruthless launch questions. |

A separate existing working-tree change under `supabase/functions/mcp/index.ts` was preserved and is not represented above as an implementation change made in this pass.

## Validation evidence

| Check | Result | Notes |
|---|---:|---|
| `python3 -m pytest app/tests/test_agent_squad.py -q` | **Pass** | 3 tests passed. Warnings only: an existing naive-UTC deprecation warning in `app/a2a/models.py`. |
| `python3 -m compileall -q app/a2a/agent_squad.py app/api/adaptations_routes.py` | **Pass** | Python syntax compilation succeeded. |
| `gofmt -d` on modified Go files | **Pass** | No formatting diff. |
| `go test ./internal/api -run 'Test.*(Application|Status|Review)' -count=1` | **Pass** | Focused Go API suite passed. |
| `npm run build` | **Pass** | Frontend production build completed. |
| `git diff --check` | **Pass** | No whitespace errors. |

## The ruthless truth

The product will not become exceptional by adding more screens or calling a simulated process an agent. It becomes exceptional when every candidate can answer four questions at every moment: **What is Tayari doing? Why is it doing it? What evidence does it have? What action still belongs to me?**

The next engineering priority is therefore not “auto apply.” It is the **approval-to-evidence spine**: canonical profile versions, exact job versions, artifact hashes, candidate approval, permitted browser worker events, sensitive-question handoff, and verified receipts. Once that spine is real, multi-agent intelligence can improve quality without creating hidden risk.

## Reference files

Read these files before continuing implementation:

| File | Purpose |
|---|---|
| [`DEEPSEEK_COPY_PASTE_PROMPT.md`](./DEEPSEEK_COPY_PASTE_PROMPT.md) | Copy-paste execution instruction for DeepSeek or another engineering agent. |
| [`backend/python/app/a2a/agent_squad.py`](../../backend/python/app/a2a/agent_squad.py) | Executable, approval-required multi-agent review implementation. |
| [`backend/go/internal/api/routes_mvp.go`](../../backend/go/internal/api/routes_mvp.go) | Server-side application-state safety validation. |
| [`src/components/TayariComputerControlRoom.tsx`](../../src/components/TayariComputerControlRoom.tsx) | Truthful control-room state and required safety-sequence UI. |
