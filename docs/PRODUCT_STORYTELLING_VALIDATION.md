# Product Storytelling Validation

**Validated locally:** 24 August 2026
**Surface:** Public homepage at `/`

## Browser Findings

The revised homepage now tells one consistent candidate journey from the first visible screen through the final call to action. The opening establishes the transformation from a scattered search to a deliberate rhythm. The next sections explain the human-control principle, make the four operating stages concrete, translate individual workspaces into practical outcomes, frame activity data honestly, and close with a low-friction next action.

| Validation area | Result | Evidence |
| --- | --- | --- |
| Positioning clarity | Pass | The hero identifies Job Tayari as “Career operations, on your terms” and states the candidate-level transformation. |
| Feature-to-impact translation | Pass | The new operating-rhythm section connects Job Search, Resume Optimizer, reviewable workflows, and receipts to four candidate outcomes. |
| Human control and safety | Pass | Sensitive answers and final decisions are explicitly described as remaining with the candidate. |
| Claims discipline | Pass | The page does not promise hiring outcomes; the activity section explains that counters describe platform activity rather than hiring outcomes. |
| Evidence and learning loop | Pass | Supported receipts are explicitly illustrative and positioned as context for a candidate’s next step. |
| Conversion continuity | Pass | The page consistently directs visitors to either a free ATS scan or the first review loop. |
| Responsive visual hierarchy | Pass at desktop viewport | Hero typography, two-path CTA, workflow cards, outcome cards, and closing CTA remain visually distinct and legible. |

## Note

The hero media shell preserves meaningful static labels and a visible workflow fallback for reduced-motion preferences. In the validation environment, the motion video did not display a discernible frame, but the permanent framing and supporting information remained sufficient to communicate the interaction model. This should be revisited only if the production media asset fails to load or plays as a blank surface in a deployed browser.

## Conversion-Path Validation

The free ATS scan presents a clear first-value path: it labels the analysis as heuristic, asks only for the resume and role text needed for review, protects candidates with a visible data-handling note, and uses a deliberate `Review my resume` action. The pricing page consistently distinguishes supported verified workflows from general product claims and frames programme adoption as a scoped conversation rather than an unverified enterprise capability.

| Route | Result | Evidence |
| --- | --- | --- |
| `/free-scan` | Pass | The first-value flow explains the heuristic scope, preserves labeled inputs, and uses the same review-first language as the homepage. |
| `/pricing` | Pass | Transparent credit policy, supported-workflow qualification, clear billing-unavailable status, and a scoped career-programme conversation are visible. |
