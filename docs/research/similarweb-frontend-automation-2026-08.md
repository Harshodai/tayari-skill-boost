# SimilarWeb-informed frontend automation UX review

## Scope

This review evaluates the JobTayari automation workspace against the user expectations created by high-traffic job-search and career-management products. The intended comparators were LinkedIn, Indeed, Glassdoor, and Huntr. The review focused on discoverability of the primary workflow, time-to-value, continuity across job discovery and pipeline tracking, and the trust signals needed before a user enables automation.

## SimilarWeb evidence status

The SimilarWeb API request was executed for global rank, total visits, bounce rate, and desktop traffic sources across all four comparator domains. The account-level provider response was `failed_precondition`: credit check passed, but the current session had insufficient SimilarWeb credits and the provider call was stopped before the underlying API request. Therefore, no competitor traffic metric is presented as fact and no UI decision is attributed to a measured competitor metric.

| Evidence | Status | Consequence |
|---|---|---|
| Global rank | Unavailable because of provider credit gate | No ranking claim is made |
| Visits trend | Unavailable because of provider credit gate | No traffic-volume claim is made |
| Bounce rate | Unavailable because of provider credit gate | No engagement benchmark is inferred |
| Desktop traffic sources | Unavailable because of provider credit gate | No acquisition-channel claim is made |
| Repository UX evidence | Available from current implementation | Used for concrete frontend changes |

## UX decisions implemented

The automation workspace now exposes the workflow as a connected graph rather than a single manual draft form. Users can select a trigger, see tenant-scoped automation definitions, start a governed run when the server permits it, and see truthful queued or approval-boundary state. The page explains that event-triggered work is durable and that email or WhatsApp delivery is not an approval authority.

The staged-off view now remains useful instead of presenting an empty feature wall. It communicates the automation domains that are planned—job discovery, pipeline care, research enrichment, interview workspace preparation, and outcome learning—while explicitly stating that no run or external message was started. This supports discoverability without implying that a disabled capability is live.

The most important product principle is continuity: a job match, an application outcome, or a Calendar interview can become a durable event, which can create a tenant-scoped run, which can pause at an approval boundary. The UI makes that lifecycle visible without claiming that a provider write or job submission occurred.

## Follow-up when SimilarWeb access is available

Re-run the saved collection script with SimilarWeb access and compare the same four domains over a common three-to-six-month period. The next review should validate whether JobTayari's entry experience is too deep, whether the automation workspace is discoverable from the job and pipeline surfaces, and whether the primary call to action should be a match review, pipeline update, or automation activation. Until that evidence exists, the repository uses conservative staged UX and does not fabricate external benchmarks.
