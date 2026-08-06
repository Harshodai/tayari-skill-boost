# Ruthless Audit Checklist

## 1. Automation & Execution
- [ ] **Functional Backend:** Verify the actual implementation of the "Apply" or "Execute" button.
- [ ] **API Connectivity:** Check if external services are connected via real APIs or just mocked.
- [ ] **Browser Agent:** Inspect the browser library (e.g., Playwright, Selenium, browser-use) for actual interaction.
- [ ] **Sandbox Environment:** Confirm if actions are performed in a secure, isolated environment.

## 2. AI & Intelligence
- [ ] **Prompt Quality:** Review LLM prompts for specificity, role-playing, and output formatting.
- [ ] **Heuristics vs. ML:** Distinguish between simple regex/rule-based scoring and actual machine learning models.
- [ ] **Data Grounding:** Ensure AI outputs are grounded in user-provided data, not hallucinations.
- [ ] **Fallback Logic:** Check what happens when the LLM API fails (canned responses vs. graceful degradation).

## 3. Security & Integrity
- [ ] **PII Protection:** Verify detection and redaction of sensitive personal information.
- [ ] **Guardrail Enforcement:** Ensure quality gates cannot be bypassed by missing data.
- [ ] **Data Encryption:** Check for encryption at rest and in transit for sensitive user profiles.
- [ ] **Access Control:** Audit RBAC (Role-Based Access Control) and Supabase/Database policies.

## 4. UI/UX & Trust
- [ ] **Visual Truth:** Ensure progress bars and logs reflect real backend state, not timers.
- [ ] **Transparency:** Check if the user can see the agent's work (e.g., screenshots, live logs).
- [ ] **Onboarding Depth:** Verify if onboarding logic covers complex use cases (e.g., career pivots).
- [ ] **Mobile Readiness:** Test responsive design and mobile-specific interactions.

## 5. Scalability & Architecture
- [ ] **Unified Logic:** Check for duplication of logic between Go/Python/Node backends.
- [ ] **Database Schema:** Audit for efficient indexing and support for future features.
- [ ] **Vector Search:** Verify implementation of semantic search vs. keyword search.
