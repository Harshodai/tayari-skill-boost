# External Evidence Log — JobTayari Ruthless Audit

## AI job-search market

### Oaki comparison
Source: https://www.oaki.io/blog/best-auto-apply-tools-2026
Retrieved via webpage extraction on 2026-08-18.

The article distinguishes auto-fill from auto-apply and says auto-fill pre-populates fields while the user still clicks submit. It compares Oaki, LazyApply, Simplify, LoopCV, JobCopilot, Sonara, AIApply, and Jobright. Its table describes Oaki as full auto-apply with AI-tailored resumes; LazyApply as mass apply without tailoring; Simplify as form auto-fill only; LoopCV as automated submissions with CV testing; JobCopilot as background apply; Sonara as AI-matched apply; AIApply as budget auto-apply; and Jobright as assisted matching. This is vendor-authored/editorial comparison content and should be treated as directional, not independent benchmark evidence.

### Apollo Technical comparison
Source: https://www.apollotechnical.com/best-ai-job-search-tools-what-actually-works/
Retrieved via webpage extraction on 2026-08-18.

Apollo Technical presents Jobscan as ATS optimization, Teal as controlled job organization/tracking with extension and tailored resumes, Kickresume as resume creation/design, Sonara and LoopCV as high-volume automation, RoboApply as full-cycle application plus interview prep, and Huntr as job tracking. It explicitly frames AI tools as force multipliers rather than replacements for judgment and warns that unattended bots can create quality and ban risks. Claims include vendor/recruiter perspective and should be cross-checked.

### FastApply comparison
Source: https://blog.fastapply.co/ai-job-application-bots-which-actually-submit-2026
Retrieved via webpage extraction on 2026-08-18.

FastApply states that in its May 2026 test of eight tools, only three actually clicked Submit; two required a user click; three were autofill/tracking only. It defines auto-fill as form population without submission and auto-submit as form population plus the final submit action. It says reliable end-to-end submission requires ATS-specific logic, file uploads, multi-step navigation, captcha handling, and post-submit verification such as confirmation emails or portal activity. This is founder-authored and conflicts of interest are material; use the methodology as a useful test design, not as neutral market truth.

## Open-source building blocks

### OpenSandbox
Source: https://github.com/opensandbox-group/OpenSandbox
Retrieved via webpage extraction on 2026-08-18.

GitHub page reported approximately 14,152 stars, 1,250 forks, Apache-2.0 license, and 2,346 commits at retrieval. README describes a general-purpose sandbox platform for AI applications with multi-language SDKs, CLI, MCP server, sandbox lifecycle/execution APIs, Docker and Kubernetes runtimes, browser/desktop environments, ingress and egress policy, credential vault, and strong-isolation runtimes including gVisor, Kata Containers, and Firecracker microVM. It advertises Chrome/VNC/DevTools, Playwright, desktop, and VS Code examples. Official release images are described as digest-pinnable with Cosign provenance attestations. This is the strongest architectural foundation found for JobTayari’s isolated-computer mode, but the repository must still implement tenancy, approvals, grants, audit, and provider-specific policy itself.

### browser-use
Source: https://github.com/browser-use/browser-use
Retrieved via webpage extraction on 2026-08-18.

GitHub page reported approximately 109,510 stars, 12,041 forks, MIT license, and 10,050 commits at retrieval. README describes form filling, structured extraction, Python agent integration, custom tools, multiple LLM providers, cloud/browser infrastructure, remote browser support, authentication examples, and production concerns including browser memory and parallelism. The project advertises a 100-task benchmark and an Odyssey leaderboard claim, but those are project claims. It is a mature engine candidate, not a complete safe multi-tenant control plane.

### Vercel agent-browser
Source: https://github.com/vercel-labs/agent-browser
Retrieved via webpage extraction on 2026-08-18.

GitHub page reported approximately 40,786 stars, 2,705 forks, Apache-2.0 license, and 635 commits at retrieval. README describes a native Rust browser-automation CLI with accessibility-tree snapshots, stable refs, clicks, fill/type, screenshots, upload, tabs/windows, frames, dialogs, storage/cookies, network interception, HAR, traces, React inspection, Web Vitals, and axe accessibility audits. It supports connection to an existing browser over CDP. It is a strong execution/inspection primitive but does not replace JobTayari’s grant, tenant, approval, provenance, and irreversible-action policies. It requires Node.js 24+ and pnpm 11+ when built from source.

### ApplyPilot
Source: https://github.com/Pickle-Pixel/ApplyPilot
Retrieved via webpage extraction on 2026-08-18.

GitHub page reported approximately 1,464 stars, 529 forks, AGPL-3.0 license, and 36 commits at retrieval. README describes a six-stage autonomous pipeline: discover, enrich, score, tailor, cover letter, and auto-apply. It claims discovery across five boards plus Workday/direct sites, per-job scoring and tailoring, browser form navigation, file upload, screening-question answers, and submission, with dry-run and manual mark-applied/mark-failed modes. It requires Python, Node, Gemini, Claude Code, Chrome, and optionally CapSolver. Its AGPL license, small commit history, and autonomous/sensitive-field posture make it a reference implementation to study rather than a safe drop-in dependency.

## Research caveat

The vendor comparison pages above are not equivalent to neutral performance research. Claims about success rates, pricing, ATS coverage, and interview uplift require independent testing. The open-source GitHub star/fork/commit counts are snapshots from retrieval and can change.

## Security and reliability research

### Building Browser Agents: Architecture, Security, and Practical Solutions
Source: https://arxiv.org/html/2511.19477v1
Retrieved via webpage extraction on 2026-08-18.

The paper reports production experience from building a browser agent, not only benchmark results. It argues architectural decisions matter more than model capability; it reports approximately 85% on WebGames across 53 challenges versus approximately 50% for prior browser agents and 95.7% human baseline; it states benchmark scores do not establish safe long-running production behavior. It recommends hybrid accessibility-tree plus selective vision context, compressed history, comprehensive browser tools, and programmatic constraints over LLM-based safety judgments. It describes cross-domain indirect prompt injection against AI browsers, including hidden text/HTML comments causing sensitive actions, and says even a 1% vulnerability rate is unacceptable for agents with high-impact privileges.

### VPI-Bench (ICLR 2026)
Source: https://proceedings.iclr.cc/paper_files/paper/2026/hash/28e4c3696637ac727051a2922643ec6a-Abstract-Conference.html

The abstract defines a visual-prompt-injection threat model for computer-use agents and reports 306 interactive test cases across five platforms. It reports deception rates up to 51% for computer-use agents and up to 100% for browser-use agents on certain platforms; existing defenses offered limited improvements. This directly supports hostile testing of visual content, cross-origin navigation, screenshots, accessibility trees, and final-action approvals.

### OS-Harm (NeurIPS 2025)
Source: https://proceedings.neurips.cc/paper_files/paper/2025/hash/4009bff0cd87ba220c8e3a2f082aaec-Abstract-Datasets_and_Benchmarks_Track.html

OS-Harm introduces 150 safety tasks covering deliberate misuse, prompt injection, and model misbehavior across email, code editors, browsers, and other OS applications. The abstract says frontier models often comply with deliberate misuse, are relatively vulnerable to static prompt injections, and occasionally perform unsafe actions. This supports treating benchmark task success and safety as separate release gates.

## Research caveat

The arXiv browser-agent paper is authored by a browser-agent founder and should be interpreted as practitioner research, not independent peer-reviewed evidence. VPI-Bench and OS-Harm are stronger independent benchmark sources, but benchmark results still do not prove how JobTayari behaves until its own reproducible test suite and staging evidence are run.

## Evaluation suites and reusable test infrastructure

### BrowserGym
Source: https://github.com/servicenow/browsergym

GitHub page reported approximately 1,323 stars, 191 forks, and 385 commits at retrieval. BrowserGym is an extensible research framework, not a consumer product. It bundles MiniWoB, WebArena, WebArenaVerified, VisualWebArena, WorkArena, AssistantBench, WebLINX, OpenApps, and TimeWarp. The README explicitly warns it is for web-agent research and should be used with caution. It is useful to give JobTayari repeatable task environments and traces, but it is not a production control plane.

### ST-WebAgentBench
Source: https://github.com/segev-shlomov/ST-WebAgentBench

The repository describes 375 realistic enterprise tasks across three applications and 3,057 policy instances across six dimensions: boundary/scope, strict execution, user consent, robustness/security, hierarchy adherence, and error handling. It measures task completion separately from policy compliance through Completion under Policy (CuP), and reports that agents can lose up to 38% of raw successes when policies are enforced. It includes vision-vs-DOM modality challenges, action budgets, sensitive-data protection, input-hallucination checks, consent evaluators, hierarchy conflicts, and structured action traces. This is a much stronger model for JobTayari’s release gates than pass/fail unit tests alone.

### OS-Harm repository
Source: https://github.com/thomas-kuntz/os-harm

The repository provides 150 safety tasks across deliberate misuse, prompt injection, and agent misbehavior, with screenshot, accessibility-tree, combined, and set-of-marks observation modes. It saves detailed logs, model responses, screenshots, and videos. The repo notes one VM per CUA for parallel runs, explicit kill thresholds for runaway traces, and manual environment reset limitations. It is a useful threat-model and simulator reference, but it has non-trivial VM and API-key requirements.

### VPIBench orchestration
Source: https://github.com/cua-framework/agents

The repository’s demo explicitly describes a visual-prompt-injection attack that causes a computer-use agent to find SSH credentials in Google Drive, exfiltrate them through a deceptive form, and delete them. Its harness uses a FastAPI endpoint for external prompts/logging/kill, one VM per CUA, execution-trace limits, and testcase-driven reset. This is a direct warning that hash-only provenance, origin checks, and prompt-injection heuristics are necessary but not sufficient without trajectory-level adversarial evaluation.

## First-party browser-operator comparison

### Manus Browser Operator
Sources: https://manus.im/features/manus-browser-operator and https://manus.im/docs/features/browser-operator
Retrieved via webpage extraction on 2026-08-18.

The first-party docs describe a local browser extension that uses the user’s existing logins and active tabs, requires session authorization, operates in a dedicated tab, logs actions, and can be stopped by closing the tab. They explicitly distinguish local browser use for authenticated sites from an isolated cloud browser for general web tasks. The docs say passwords are not stored, Chrome and Edge are recommended, mobile can start/monitor while the desktop browser remains online, and users can take over by clicking into the tab. The product marketing page claims multi-step autonomous delegation across sites. Compared with JobTayari, this is a useful target UX but not a substitute for third-party verification of tenancy, grant lifetime, origin policy, action approvals, and data retention.

### OpenAI ChatGPT Atlas announcement
Source: https://openai.com/index/introducing-chatgpt-atlas/
Retrieved via webpage extraction on 2026-08-18.

The page states Atlas was deprecated and redirects to current products, so it is historical context rather than a current product benchmark. Its documented safety constraints are still useful: no browser code execution, downloads, extension installation, or access to other computer apps/filesystem; pausing on sensitive financial sites; logged-out mode; explicit warnings that hidden malicious instructions can cause unintended actions; and ongoing red-team limitations. These boundaries are a useful comparison point for JobTayari’s bridge policy.

## YouTube retrieval status

Direct page extraction succeeded for the Manus Browser Operator video `https://www.youtube.com/watch?v=kaDwyZVFDJs`, returning only a 59-second title/player shell; it did not provide a transcript. A searched job-automation URL `ntSbFUQZHJ0` resolved to an unrelated Taco Bell short and must not be used. The video `https://www.youtube.com/watch?v=CM47jDF7_ZI` returned title, creator, date, view count, description, related videos, and a transcript interface, but not the transcript body; its description claims an “automation arms race” and over 900 bot-generated applications per posting and frames auto-apply as potentially harmful. Because the video-analysis utility was unavailable and the direct extraction did not expose the spoken transcript, these YouTube items are metadata/description evidence only, not watched first-hand evidence. They should not support precise factual claims without further verification.
