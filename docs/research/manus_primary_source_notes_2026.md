# Manus Primary-Source Findings (12 August 2026)

## Official sources consulted

1. https://manus.im/docs/features/browser-operator
2. https://manus.im/docs/features/cloud-browser
3. https://manus.im/docs/integrations/manus-browser-operator
4. https://manus.im/blog/deep-dive-browser-operator-connector

## Findings relevant to Job Tayari

Manus distinguishes an isolated Cloud Browser from a Browser Operator that works in an explicitly authorized local Chrome/Edge session. The local operator requires per-session authorization, uses a dedicated task tab/tab group, exposes visible actions and an audit trail, supports take-over by interacting with the tab, and stops when the dedicated tab is closed. Manus states it does not store passwords.

The Cloud Browser documentation describes per-user isolated browser instances, encrypted sessions, account/session management, selectable logged-in accounts, logout/clear-session controls, and take-over for CAPTCHA, codes, and verification challenges. It notes data-centre IP limitations and advises use of a local browser for trusted local-IP sessions. The 2026 Browser Operator deep dive reinforces a plan/authorize/observe/interrupt/take-over collaboration model, including pause at sensitive actions such as payments.

## Job Tayari design decisions derived from these sources

1. Provide two explicit execution adapters, not one ambiguous “computer”: a cloud-isolated draft browser for allowlisted public and low-risk actions, and a user-authorised local-browser adapter for authenticated job portals.
2. Bind a short-lived browser lease to exactly one candidate, run, policy version, approval scope, and allowed-domain list. Never store raw passwords; persist only revocable session/connector references.
3. Maintain a detailed event ledger with a visible plan, current URL/domain, navigation/action records, screenshot/evidence references, agent state, and human takeover/stop controls.
4. Stop must be server-enforced, not merely cosmetic. Closing/revoking a run marks the lease revoked, terminates the worker, invalidates queued external actions, and demands receipt reconciliation before any retry.
5. A task must pause for CAPTCHA, MFA, unrecognised prompts, sensitive data, self-identification questions, account terms, outbound communication, and final application submission. The authenticated web review centre is the only final approval surface.

## Sources

- [Manus Browser Operator](https://manus.im/docs/features/browser-operator)
- [Manus Cloud Browser](https://manus.im/docs/features/cloud-browser)
- [Manus Browser Operator Integration](https://manus.im/docs/integrations/manus-browser-operator)
- [Manus Browser Operator deep dive](https://manus.im/blog/deep-dive-browser-operator-connector)
