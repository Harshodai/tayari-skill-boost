# WhatsApp Approval Channel

**Feature status:** Implemented locally; live connectivity and Meta acceptance remain **NOT VERIFIED**.

## Product behavior

WhatsApp is a **notification and approval channel**, not a second approval store. A candidate creates an approval in the canonical in-app workflow. When WhatsApp is enabled, the server sends an approved Meta template containing the bounded approval summary, review URL, and two quick replies: approve and deny. The candidate’s button reply is processed only when the webhook signature, business phone-number ID, WhatsApp identity, signed payload, approval ownership, approval expiry, risk policy, and current approval state all pass. The canonical approval and automation run are then updated transactionally with `decision_channel='whatsapp'`.

Free-form WhatsApp text is never interpreted as approval. Provider acceptance is recorded as a delivery state and does not itself approve or execute an action. `submission` risk remains blocked by the server-side manual-submit policy, and `AUTONOMOUS_SUBMIT_ENABLED=false` remains mandatory.

## Current implementation

| Component | Behavior | Verification status |
|---|---|---|
| Outbound provider | Meta Cloud API template message with body parameters and two signed quick-reply button payloads | Local fake-provider test passes; real Meta send NOT VERIFIED |
| Approval payload | HMAC-bound `tayari.approval.v1` payload containing approval ID and approve/deny decision | Local tamper and unsupported-decision tests pass |
| Webhook GET | Requires `hub.mode=subscribe`, configured verify token, non-empty challenge, and constant-time comparison | Local handler contract implemented; public TLS verification NOT VERIFIED |
| Webhook POST | Validates `X-Hub-Signature-256` over the exact body and the configured business phone-number ID | Local signature tests pass; real Meta delivery NOT VERIFIED |
| Inbound approval | Accepts only interactive/button replies or legacy quick-reply payloads; maps `messages[].from` to a stored provider WhatsApp ID | Local parser tests pass; real inbound event NOT VERIFIED |
| Replay protection | Deduplicates provider message/status events and only transitions an approval once while it is pending/delivered/viewed | Local transaction path implemented; staging replay test pending |
| Authenticated abuse control | Link, confirm, and outbound notification routes inherit the authenticated user rate limiter | Local route wiring and full Go tests pass |
| Deployment wiring | Production and AWS Compose pass the WhatsApp provider/webhook variables through to Go and default both WhatsApp-related capabilities to false | Compose render and strengthened promotion gate pass; live secret-manager injection not verified |
| Preferences | Requires explicit opt-in, a valid E.164 phone number, a short-lived six-digit ownership challenge, and an enabled WhatsApp preference | Local challenge/attempt/expiry logic and exact-phone binding pass focused tests; real Meta link acceptance and final opt-out UX remain pending |
| Feature exposure | `workspace.notification.whatsapp` and `workspace.approvals` are disabled by default in staging/production until explicitly enabled | Correct fail-closed default |

## Required Meta configuration

The operator must create or use a WhatsApp Business Platform application and business phone number, configure a public HTTPS callback URL, and subscribe the WhatsApp Business Account to the `messages` field. Meta’s webhook verification requires `hub.mode=subscribe`, `hub.challenge`, and a server-held verify token; POST requests carry `X-Hub-Signature-256`, an HMAC-SHA256 digest of the exact request body using the Meta app secret. Meta can batch events and retry failed webhook deliveries, so durable capture and deduplication are mandatory. See the official Meta webhook documentation [1].

The business must create and obtain approval for a utility/notification template with two quick-reply buttons. The template must have a body with bounded summary and review-link parameters, and quick-reply payloads that the server can replace per approval. Meta’s template documentation permits up to three quick-reply buttons and requires the button payload to be supplied in the template send request. See [2]. The launch owner must confirm the template name, locale, variable ordering, button indexes, and message category in the Meta Business Manager account.

The server requires the following environment keys, stored in the approved secret manager and never in Git, frontend bundles, task payloads, or ordinary logs:

| Key | Purpose |
|---|---|
| `WHATSAPP_GRAPH_API_BASE_URL` | Approved Graph API base URL |
| `WHATSAPP_GRAPH_API_VERSION` | Pinned Graph API version |
| `WHATSAPP_ACCESS_TOKEN` | Narrowly scoped business/system token |
| `WHATSAPP_PHONE_NUMBER_ID` | Business phone-number identifier |
| `WHATSAPP_APPROVAL_TEMPLATE_NAME` | Approved approval template name with two quick replies |
| `WHATSAPP_LINK_TEMPLATE_NAME` | Approved phone-link verification template with a code variable |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook GET verification secret |
| `WHATSAPP_APP_SECRET` | POST signature verification secret |
| `APPROVAL_SIGNING_KEY` | Server-only signing key for button payloads and approval policy |
| `CAPABILITY_WORKSPACE_NOTIFICATION_WHATSAPP` | Explicit launch-scope enablement; false by default in staging/production |
| `CAPABILITY_WORKSPACE_APPROVALS` | Approval capability required for inbound decision processing |

Staging and production require separate WhatsApp applications or explicitly separated business assets, tokens, template configuration, callback URLs, signing keys, and recipient cohorts. A user’s phone number must be normalized to E.164 and must be explicitly opted in. The Messages API response includes both the input phone number and a returned `wa_id`; Meta documents that the two may not match, so the returned `wa_id` is stored as the provider identity and later matched against inbound `messages[].from` [3]. The current code records the returned identity after a successful send and now requires a short-lived, five-attempt-limited code confirmation before enabling delivery for a new number. The operator must still validate the complete staging flow with the real Meta test asset.

## Safe staging acceptance

The staging acceptance must use a dedicated Meta test number or approved non-production business asset and disposable users. It must prove the following without executing any external application submission:

| Test | Required observation |
|---|---|
| Webhook verification | Meta’s GET challenge returns HTTP 200 and the exact challenge only for the configured token |
| Invalid signature | POST with a changed body or wrong app secret is rejected; no database mutation occurs |
| Phone link | An approved link template sends a six-digit code; only the matching unexpired code within five attempts enables the exact verified phone, and a different phone requires a new challenge |
| Provider send | Template send succeeds with the expected locale, summary, review URL, two button indexes, and opaque payloads |
| Opt-in boundary | Missing opt-in, invalid E.164, opted-out, or unverified recipient is refused before provider send |
| Identity boundary | A button from an unrecognized or different `wa_id` cannot affect any approval |
| Approval mapping | A valid approve/deny reply changes only the owner’s exact pending approval and emits the correct durable event |
| Replay | Replaying the same WhatsApp message ID is acknowledged but does not change state twice |
| Expiry | An expired approval is recorded as an ignored/expired inbound event and cannot be approved |
| Risk boundary | A `submission` approval remains blocked even when the WhatsApp button is valid |
| Delivery status | Sent, delivered, read, and failed status callbacks reconcile to the correct delivery; duplicates are idempotent |
| Failure recovery | Provider timeout, webhook retry, database outage, and worker restart leave the canonical approval explainable and safe |
| Privacy | Logs and stored audit payloads contain no access token, app secret, signing key, phone-number secret, resume text, or raw free-form message body |

The exact staging release SHA, image digests, migration fingerprint, both template configuration records, sanitized request/response evidence, phone-link evidence, webhook replay evidence, delivery-status evidence, and operator approval must be attached before enabling the capability for a canary cohort.

## Known limitations and release decision

The current repository has no live Meta credentials, public staging callback, approved template, verified test recipient, or external delivery evidence in this environment. The local fake-provider and parser tests therefore demonstrate implementation behavior only. Until the staging acceptance table is completed, WhatsApp approval remains disabled in staging/production and the release remains **NOT READY FOR PRODUCTION**.

Meta explicitly states that service messages outside an open customer-service window require approved templates and that recipients must have opted in [4]. The implementation therefore does not send unapproved free-form outbound messages for approval notifications and does not treat a self-entered phone number as sufficient proof of ownership.

## References

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/ "Meta — Create a webhook endpoint"
[2]: https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates/ "Meta — Interactive message templates"
[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/interactive "Meta — Interactive messages webhook reference"
[4]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages "Meta — WhatsApp service messages"
