# Job Tayari Chrome Extension Agent Expansion

## Product direction

Job Tayari’s Chrome extension now has a page-aware side-panel workspace rather than only a job-action card. The interaction model is inspired by public descriptions of Claude in Chrome, Perplexity Comet, and Chrome’s official side-panel API, but the implementation remains Job Tayari-specific and does not copy proprietary code, private classifiers, or undisclosed model behavior.

The side panel supports three bounded modes: **Ask**, **Research across tabs**, and **Draft only**. A user can ask about the current page, use selected text, compare approved career-oriented tabs, save redacted evidence, or create a durable Job Tayari task. The extension creates the task in `awaiting_plan_approval`, renders the proposed steps, and exposes explicit approve, reject, takeover, and stop controls. Approval does not authorize final application submission.

## New capabilities

| Capability | Behavior | Safety boundary |
|---|---|---|
| Page-aware prompt | Captures bounded visible text, title, URL, selection, and existing job context from the active tab. | Captured content is labeled `untrusted`; page text cannot expand task scope or authorize actions. |
| Selection workflow | Context menu and “Use selection” actions place selected text into the panel prompt. | Selection is capped and remains user-initiated. |
| Cross-tab research | Reads up to eight tabs in the current window when the user checks “Include open tabs.” | Only HTTPS career/research origins are eligible; unknown origins are excluded. |
| Plan-first task | Creates a durable task and plan through the authenticated Go task API. | The task remains awaiting plan approval until the user approves it. |
| Evidence shelf | Saves page excerpts or selected text locally with URL and timestamp. | Bounded local storage, credential-like redaction, and a clear-shelf control. |
| Task controls | Shows durable task status and su| Task controls | Shows durable task statp. | Mutations use authenticated owner-scoped backend routes; stop remains available. |
| Attention notification | Notifies the user when a review plan is ready. | Notification only asks for review; it never starts execution. |
| Native coordination | Preserves the existing typed native bridge and connection indicator. | No arbitrary shell, password/MFA, CAPTCHA, unrestricted cookie, or final-submit operation. |

## Safety model

The extension denies web-page bearer-token provisioning and retains the PKCE-owned session flow. Browser page content is treated as data, not instructions. A lightweight client warning flags instruction-like strings such as requests to ignore previous instructions, reveal prompts, or send credentials; the backend policy and approval system remain authoritative.

Sensitive application fields continue to require an explicit approval checkbox and action. Final application submission remains blocked by default and is not exposed as a side-panel action. Evidence is redacted before local persistence, but users should still avoid opening the panel over highly sensitive pages because visible context can contain personal data.

## Research basis

Claude’s public documentation describes a persistent side panel, page reading and interaction, saved sessions, contextual suggestions, multi-tab work, shortcuts, background workflows, notifications, and explicit permission modes. Its public safety guidance emphasizes prompt-injection risk, allowlists/blocklists, action confirmations, manual approval, and caution around screenshots and sensitive data.[1][2]

Perplexity’s public Comet announcement emphasizes asking questions in place, highlighting text, comparing information across pages, preserving conversational context, and executing bounded multi-step workflows.[3] Chrome’s official documentation confirms that the `sidePanel` API supports persistent side-panel experiences, tab-specific configuration, explicit user-gesture opening, and side-panel access to extension APIs.[4]

Open-source projects were reviewed for reusable architecture ideas rather than copied implementation. Nanobrowser demonstrates a multi-agent browser extension with a side panel, live status, follow-up questions, and conversation history under Apache-2.0.[5] Open Browser Agent demonstrates local conversations, live tool activity, mid-run steering, context compaction, and explicit browser-tool switches under GPL-3.0; it should be treated as an architectural reference only, not a dependency or code source.[6] Playwright remains the mature reference for accessibility-oriented browser automation and traceable testing under Apache-2.0.[7]

## References

[1]: https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome "Get started with Claude in Chrome"
[2]: https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely "Use Claude in Chrome safely"
[3]: https://www.perplexity.ai/hub/blog/introducing-comet "Introducing Comet"
[4]: https://developer.chrome.com/docs/extensions/reference/api/sidePanel "Chrome sidePanel API"
[5]: https://github.com/nanobrowser/nanobrowser "Nanobrowser"
[6]: https://github.com/lifanwar/open-browser-extensions "Open Browser Agent"
[7]: https://github.com/microsoft/playwright "Microsoft Playwright"

## First-hand video research

A public Comet demonstration was reviewed for workflow structure, plan visibility, action confirmation, multi-tab context, background monitoring, self-correction, uncertainty handling, and privacy controls: [Perplexity Comet agent demonstrations](https://www.youtube.com/watch?v=lqAHw6TwLsk). The video was used to identify interaction patterns only; it is not treated as ground truth for implementation or security claims.

## End-to-end execution and desktop handoff

After the user approves a proposed plan, the extension invokes the authenticated `/v1/agent/page-answer` route. The route accepts only explicitly supplied HTTPS page context, wraps all page text with the existing untrusted-data delimiter, and returns a read-only answer with source metadata. It cannot navigate, fill, send, submit, or alter a page.

The extension can open `/desktop/tasks/:taskId` in the shared control room. The desktop app now validates `tayari://desktop/tasks/<uuid>` links, forwards them through the isolated preload bridge, and navigates the trusted React renderer to a live task view. That view polls task state and events, exposes durable plan approval, action proposal decisions, takeover, and stop controls, and keeps submission disabled.
