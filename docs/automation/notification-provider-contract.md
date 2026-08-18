# JobTayari Notification Provider Contract

## Purpose

The notification layer transports approval requests and decisions. It is not the approval authority and it is not proof that an automation action executed. The canonical approval record remains in JobTayari and binds the user, tenant, action snapshot, policy version, expiry, and one-time decision state.

## Outbound interface

Every provider adapter implements the following conceptual operations:

| Operation | Required behavior |
|---|---|
| `sendApproval` | Accept a redacted canonical approval view and an idempotency key; return a provider request ID or a truthful configuration/error result. |
| `getDeliveryStatus` | Normalize provider status into `accepted`, `sent`, `delivered`, `read`, `bounced`, `complained`, `failed`, or `unknown`. |
| `cancelOrSuppress` | Prevent future retries after expiry, revoke, deny, consume, or user opt-out when the provider supports it. |
| `verifyWebhook` | Verify signature, timestamp/nonce, provider event ID, and configured endpoint identity before changing delivery state. |
| `handleInboundDecision` | Parse only provider-supported reply or link formats, then pass a signed decision intent to the canonical approval service. |
| `healthCheck` | Return configured/unconfigured and provider reachability state without exposing secrets. |

## Email adapter

The initial email adapter may target Amazon SES, Postmark, or another transactional provider, but the approval service must not depend on vendor-specific response shapes. It must support sender-domain verification, idempotent send, accepted/delivered/bounce/complaint events, suppression, retry classification, and provider request correlation. Approval payloads are never embedded raw in email bodies or URLs; the email contains a redacted summary and a link to the authenticated review surface.

## WhatsApp adapter

The initial WhatsApp adapter may target Meta WhatsApp Business Cloud API directly or an enterprise provider with equivalent semantics. It must support explicit opt-in, verified phone numbers, approved templates where required, interactive replies or authenticated review links, delivery/read/failed states, inbound webhook verification, duplicate-event protection, opt-out, and phone-number changes. A button label alone never authorizes an action; the inbound event must carry a valid single-use correlation token and match the current action hash.

## Delivery state rules

A provider response of `accepted` means only that the provider accepted the request. It does not mean the user saw it, approved it, or that the downstream action succeeded. Delivery state and execution state are separate event streams. A provider outage results in `delivery_failed` plus an in-app fallback, not a fabricated success.

All outbound messages include a correlation ID, approval ID, channel, provider, and redacted action title. Logs exclude raw addresses where possible, raw phone numbers, raw tokens, message bodies containing sensitive fields, access tokens, and provider secrets. All delivery events are retained according to the automation and privacy retention policy and are deletable/exportable under the user’s data controls.
