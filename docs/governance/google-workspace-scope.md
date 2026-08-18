# JobTayari Google Workspace Scope

## Release boundary

JobTayari’s first governed Google Workspace release supports **Gmail, Google Calendar, and Google Drive** as separate candidate-controlled connections. Each connection has independent consent, tenant-bound token storage, refresh, local disconnection, provenance, and a production launch gate. The first release is read-only: it does not send Gmail, create or edit Calendar events, or create, edit, share, download, or delete Drive files.

Google’s authorization guidance recommends requesting the narrowest scope that meets the product need and notes that public applications using user-data scopes may require verification.[^1] JobTayari therefore uses `gmail.readonly`, `calendar.events.readonly`, and `drive.metadata.readonly` for the implemented release. Drive synchronization stores metadata only; it does not fetch file content.

| Workspace service | Product use | First-release scope | State | External side effects |
|---|---|---|---|---|
| Gmail | Parse candidate-approved recruiting signals and interview messages | `https://www.googleapis.com/auth/gmail.readonly` | Existing integration hardened and still disabled in production by launch scope | None; no send, label, archive, delete, or mailbox mutation |
| Calendar | Surface upcoming interview and recruiting events | `https://www.googleapis.com/auth/calendar.events.readonly` | Implemented, disabled by default | None; no event creation or edits |
| Drive | Index candidate-selected resume and cover-letter metadata | `https://www.googleapis.com/auth/drive.metadata.readonly` | Implemented, disabled by default | None; no file download or mutation |
| Sheets | Potential candidate-controlled tracker export/import | Not requested | Staged design only | Disabled; no Sheets scope requested |
| Docs | Potential candidate-approved document drafting | Not requested | Staged design only | Disabled; no Docs scope requested |
| Slides | Potential candidate-approved presentation generation | Not requested | Staged design only | Disabled; no Slides scope requested |
| Contacts | Potential recruiter/contact lookup | Not requested | Excluded from first release | Disabled; no Contacts scope requested |
| Tasks | Potential follow-up reminders | Not requested | Staged design only | Disabled; no Tasks scope requested |
| Meet | Meeting metadata or recordings | Not requested | Excluded from first release | Disabled; no Meet scope requested |
| Admin SDK and domain-wide delegation | Organization administration | Never part of candidate integration | Prohibited | No admin or domain-wide scopes |

## Security and lifecycle contract

OAuth states are nonce-bound, provider-bound, tenant-bound, and time-limited. Bearer tokens and synchronized records are server-only tables with forced RLS, revoked client-role grants, and explicit service-role access. Production and staging require a verified tenant context; requests without one fail closed. Disconnect deletes the local provider token for the active user and tenant. Imported Calendar and Drive records carry a provider identifier and a machine-readable provenance value.

The UI discloses the exact scope before consent. It also states that the current release does not create, edit, share, delete, send, or submit anything in Google Workspace. The integration remains hidden from production capability behavior until live provider, two-tenant, revocation, deletion, outage, and audit evidence is attached to the release bundle.

Google Calendar supports push notification channels for events and other resources, but Google documents that notifications do not contain the changed resource and are not 100% reliable.[^2] JobTayari therefore uses bounded read-only synchronization first and will not treat a webhook as a complete source of truth until channel renewal, replay, drop recovery, and tenant attribution evidence are proven. Google Drive also provides a changes-watch method, but it accepts multiple scopes, including metadata-only access.[^3]

## Promotion requirements

The Calendar and Drive capabilities remain `disabled` in `docs/launch/2026-workspace-scope.yml` until the staging bundle includes successful OAuth consent and callback evidence, least-privilege scope confirmation, refresh and expiry handling, disconnect/revocation evidence, two-tenant negative tests, metadata deletion proof, provider outage behavior, redacted logs, and a live read-only provider probe. No future Sheets, Docs, Slides, Contacts, Tasks, Meet, or Admin SDK integration may be added by reusing a broader Drive or domain-wide scope.

## References

[^1]: [Google Calendar API: Choose API scopes](https://developers.google.com/workspace/calendar/api/auth) and [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes).
[^2]: [Google Calendar API: Push notifications](https://developers.google.com/workspace/calendar/api/guides/push).
[^3]: [Google Drive API: changes.watch](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch).
