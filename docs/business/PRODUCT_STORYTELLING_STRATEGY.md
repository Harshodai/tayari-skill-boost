# Product Storytelling Strategy: From Capabilities to Candidate Impact

**Author:** Manus AI
**Scope:** Public product experience, homepage, and conversion paths
**Status:** Implementation blueprint

## Strategic Assessment

Job Tayari already contains a substantial career-operations product: role discovery, resume tailoring, application tracking, review queues, interview preparation, answer banking, and controlled automation. The public experience makes several of these capabilities visible, but it currently asks visitors to infer the product’s unifying value from a feature catalogue. The message is strongest when it describes candidate control and proof, but it does not yet fully show the consequential human journey: why a candidate should change behaviour, what becomes easier, and what evidence of progress they retain.

The correct positioning is **not** an unsupported claim that Job Tayari is an enterprise product. Its public experience is aimed at an individual engineering candidate. The strategic opportunity is to make the experience feel **enterprise-grade in discipline**—clear workflow stages, explicit review, measurable signals, and an auditable record—while keeping the promise human, practical, and truthful.

> **Core promise:** Job Tayari helps candidates turn an anxious, fragmented search into a deliberate operating rhythm: choose better opportunities, prepare truthful materials, decide before action, and learn from every step.

| Current surface | Current message | Storytelling opportunity | Intended human impact |
| --- | --- | --- | --- |
| Hero | Inspect before anything goes out | State the before-and-after transformation in the first screen | Less uncertainty; greater agency before each application |
| Feature cards | Product modules and interface previews | Explain each capability as a move in a dependable operating rhythm | Better choices, less repeated work, clearer context |
| Candidate control | Visible workflow and user approval | Make human permission the product principle, not a technical detail | The candidate remains accountable and in control |
| Receipt showcase | Example confirmation record | Connect receipts to reflection and learning, not only proof | A retraceable search rather than a pile of submissions |
| Closing CTA | Control your engineering search | Offer a clear, low-commitment first moment of progress | Begin with a diagnostic or a guided first workflow |

## Narrative Architecture

The public journey should progress from human friction to visible progress rather than from feature to feature.

| Narrative beat | Visitor question | Answer the product must provide | Experience component |
| --- | --- | --- | --- |
| 1. Name the friction | “Why does my job search feel unmanageable?” | Too many choices, scattered context, and opaque automation create uncertainty | Hero and a concise problem frame |
| 2. Define the new way of working | “What changes with Job Tayari?” | The search becomes a reviewable operating rhythm, not a volume contest | Control-path section |
| 3. Make the workflow concrete | “What happens in practice?” | Discover, prepare, decide, and learn form a closed loop | Journey map with outcomes and supporting product surfaces |
| 4. Establish human control | “What does the product do without me?” | It can organise and prepare; sensitive answers and final actions remain explicit decisions | Permission and provenance panel |
| 5. Show credible evidence | “How do I know what happened?” | Receipts and context preserve an understandable record when supported by the destination workflow | Evidence/receipt section |
| 6. Reduce the start barrier | “What can I try now?” | Start with a free diagnostic or build the first review loop | Dual-path CTA |

## Copy and Design Principles

The implementation must make the following choices consistently.

| Principle | Application |
| --- | --- |
| Lead with the human outcome | Headings should describe a candidate’s improved way of working before naming a feature. |
| Translate every capability | Each product surface needs an accompanying “so you can” explanation grounded in its real function. |
| Keep claims verifiable | Avoid fabricated customer numbers, employer partnerships, placement guarantees, or unqualified automation claims. |
| Show the candidate’s agency | Use explicit language such as “you review,” “you decide,” and “you keep the context.” |
| Treat evidence as a learning loop | Frame status, receipts, and saved materials as usable context for the next decision. |
| Make the first action obvious | Pair the higher-intent signup with a free ATS scan that demonstrates immediate value. |
| Make discipline feel warm | Retain the dark product-operating-system visual language, but offset it with clear hierarchy, calm copy, and accessible contrast. |

## Implementation Direction

The homepage will retain the existing architecture and authentic product routes while introducing a dedicated **Career Operating Rhythm** section. This section will bind four real workflows to four human outcomes:

| Stage | Real product route or surface | Capability | Human outcome |
| --- | --- | --- | --- |
| Choose | Job Search | Save and compare relevant opportunities | Spend energy on roles worth a considered application |
| Prepare | Resume Optimizer and Cover Letter | Tailor materials against the role | Present relevant evidence without losing your voice |
| Decide | Review queue and controlled workflows | Inspect work before a final action | Move with confidence rather than black-box automation |
| Learn | Application tracker and supported receipts | Retain status, context, and confirmation | Know what happened and improve the next attempt |

The new section will be implemented as a reusable landing component. Existing hero, control-path, social-proof, receipt, and closing-CTA copy will be aligned to the same narrative. No false product capabilities will be added.

## Success Criteria

The work is complete when a first-time visitor can understand, without navigating away from the homepage, all of the following:

1. **Who Job Tayari is for:** engineering candidates who want a deliberate career-search workflow.
2. **What changes:** fragmented searching becomes a controlled, reviewable operating rhythm.
3. **How it works:** choose, prepare, decide, and learn are the four connected stages.
4. **Why it is trustworthy:** sensitive answers and final decisions stay with the candidate, while supported workflows retain useful evidence.
5. **Where to begin:** start with a free ATS scan or build the first review loop.

The supporting code must remain responsive, keyboard-accessible, motion-aware, lint-clean, and production-buildable.
