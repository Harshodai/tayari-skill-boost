# Roadmap

- [ ] Close checkout, webhook fulfillment, dashboard credit, and receipt dead ends in Stripe test mode.
- [ ] Close verified-submission debit reconciliation and refund-flow dead ends.
- [ ] Harden the single manual-submit policy boundary and preserve sensitive-field handoffs.
- [ ] Build and validate the complete local Docker stack: frontend, Go, Python, Celery, Redis, local database/auth/storage.
- [ ] Add deterministic end-to-end coverage for signup, checkout, credits, job search, selection, preparation, human submit, receipt verification, debit, and dashboard display.
- [ ] Run a real-job supervised proof up to the human submission boundary, then verify the returned ATS evidence.
- [ ] Define and package a leak-safe open-source core while retaining proprietary scoring, prompts, hosted operations, and commercial data.
- [ ] Record the completed work and reusable lessons in lessons.md.
