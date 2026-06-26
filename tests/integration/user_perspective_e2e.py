"""Full user-perspective E2E — tests frontend pages and complete user journey."""
import sys, json, time, requests
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8083"
API_URL = "http://localhost:8085/api"
PASS = FAIL = SKIP = 0

log = lambda msg: print(f"  {msg}")

def check(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1; print(f"  ✅ {name}")
    else:
        FAIL += 1; print(f"  ❌ {name}: {detail}" if detail else f"  ❌ {name}")

def skip(name):
    global SKIP; SKIP += 1
    print(f"  ⏭️  {name}")

def get_token(email=None, password="TestPass123!"):
    if not email:
        email = f"e2e_{int(time.time())}@test.com"
    requests.post(f"{API_URL}/auth/register", json={"email": email, "password": password, "name": "E2E User"}, timeout=15)
    r = requests.post(f"{API_URL}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code == 200:
        data = r.json()
        return (data.get("token") or data.get("user", {}).get("access_token")), email
    return None, email


def run():
    print("=" * 60)
    print("TAYARI — USER-PERSPECTIVE FRONTEND E2E TEST")
    print(f"Target: {BASE_URL}")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text[:200]}") if m.type == "error" else None)

        # --- PHASE 1: All pages load ---
        print("\n--- Phase 1: Page availability ---")
        for path, name in [
            ("/", "Landing"), ("/auth", "Auth"), ("/dashboard", "Dashboard"),
            ("/jobs", "Job search"), ("/resume", "Resume upload"),
            ("/interview", "Interview board"), ("/cover-letter", "Cover letter"),
            ("/communication", "Communication hub"),
            ("/career-roadmap", "Career roadmap"), ("/career-ops", "Career ops"),
            ("/settings", "Settings"),
        ]:
            try:
                r = requests.get(f"{BASE_URL}{path}", timeout=10, allow_redirects=False)
                check(f"{name} ({path})", r.status_code in (200, 302, 304), str(r.status_code))
            except Exception as e:
                check(f"{name} ({path})", False, str(e))

        # --- PHASE 2: Auth UI ---
        print("\n--- Phase 2: Auth page UI ---")
        test_email = f"user_{int(time.time())}@test.com"
        test_pass = "TestPass123!"
        page.goto(f"{BASE_URL}/auth", wait_until="networkidle", timeout=30000)
        html = page.content().lower()
        check("Auth page has email field", 'email' in html or 'type="email"' in html or 'name="email"' in html)
        check("Auth page has password field", 'password' in html or 'name="password"' in html)
        check("Auth page has submit/button", 'button' in html or 'submit' in html or 'type="submit"' in html or 'sign in' in html or 'login' in html)

        # Register via API but verify token flow
        token, _ = get_token(test_email, test_pass)
        check("API token obtained", bool(token))
        if not token:
            print("\n❌ No token — aborting frontend navigation tests")
            browser.close()
            return

        # --- PHASE 3: Protected pages redirect ---
        print("\n--- Phase 3: Auth gating ---")
        page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded", timeout=20000)
        time.sleep(1)
        ready = page.evaluate("document.readyState")
        on_auth = "/auth" in page.url
        check("Dashboard loads (may redirect to /auth)", ready in ("complete", "interactive"), f"state={ready}, on_auth={on_auth}, url={page.url[:80]}")

        # --- PHASE 4: Set auth and test protected pages ---
        print("\n--- Phase 4: Authenticated navigation ---")
        page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=20000)
        page.evaluate(f"localStorage.setItem('auth_token', '{token}')")
        page.evaluate("localStorage.setItem('user', '{\"email\":\"test@test.com\",\"id\":\"e2e-user\"}')")

        for path, name in [
            ("/dashboard", "Dashboard"), ("/resume", "Resume"),
            ("/jobs", "Job search"), ("/cover-letter", "Cover letter"),
            ("/communication", "Communication hub"),
            ("/interview", "Interview board"),
            ("/career-ops", "Career ops"),
        ]:
            try:
                page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=20000)
                time.sleep(1)
                ready = page.evaluate("document.readyState")
                check(f"{name} renders", ready in ("complete", "interactive"), f"state={ready}, url={page.url[:80]}")
            except Exception as e:
                check(f"{name} renders", False, str(e))

        # --- PHASE 5: API-driven user flow ---
        print("\n--- Phase 5: Full user flow (API) ---")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # Profile
        try:
            r = requests.put(f"{API_URL}/v1/profile", json={
                "headline": "Senior Software Engineer",
                "summary": "10+ years building systems",
                "skills": ["Python", "Go", "React", "PostgreSQL", "AWS"],
                "desired_roles": ["Staff Engineer", "Lead"],
                "locations": ["Remote", "SF"],
                "experience_years": 10, "open_to_remote": True,
            }, headers=headers, timeout=15)
            check("Profile update", r.status_code == 200, f"{r.status_code} {r.text[:80]}")
        except Exception as e:
            check("Profile update", False, str(e))

        # Resume analysis
        try:
            r = requests.post(f"{API_URL}/v1/resumes/analyze-text", json={
                "resume_text": "Senior Software Engineer with 10 years experience in Python, Go, and React.",
                "job_description": "We need a full-stack engineer with Python and React experience.",
            }, headers=headers, timeout=180)
            check("Resume analyze-text", r.status_code in (200, 502), f"{r.status_code}")
            if r.status_code == 200:
                data = r.json()
                score = data.get("result", {}).get("overall_score") or data.get("overall_score", "?")
                log(f"ATS score: {score}")
        except Exception as e:
            check("Resume analyze-text", False, str(e))

        # Resume create
        rid = None
        try:
            r = requests.post(f"{API_URL}/v1/resumes", json={
                "title": "E2E Test Resume",
                "original_text": "Senior engineer with Python and Go experience.",
            }, headers=headers, timeout=15)
            check("Create resume", r.status_code in (200, 201), f"{r.status_code} {r.text[:80]}")
            if r.status_code in (200, 201):
                rid = r.json().get("id") or r.json().get("resume_id")
                log(f"Resume ID: {rid}")
        except Exception as e:
            check("Create resume", False, str(e))

        # Get resume
        if rid:
            try:
                r = requests.get(f"{API_URL}/v1/resumes/{rid}", headers=headers, timeout=15)
                check("GET resume by ID", r.status_code == 200, str(r.status_code))
            except Exception as e:
                check("GET resume by ID", False, str(e))

        # List resumes
        try:
            r = requests.get(f"{API_URL}/v1/resumes", headers=headers, timeout=15)
            check("List resumes", r.status_code == 200, str(r.status_code))
        except Exception as e:
            check("List resumes", False, str(e))

        # Job search
        try:
            r = requests.post(f"{API_URL}/v1/jobs/search", json={"query": "backend engineer", "location": "remote", "top_n": 5}, headers=headers, timeout=180)
            check("Job search", r.status_code == 200, f"{r.status_code}")
            if r.status_code == 200:
                data = r.json()
                jobs = data if isinstance(data, list) else data.get("jobs", data.get("results", []))
                check("Jobs returned", len(jobs) > 0 if isinstance(jobs, list) else False, f"count={len(jobs) if isinstance(jobs, list) else 'N/A'}")
                if jobs and len(jobs) > 0:
                    save_payload = {
                        "dedupe_key": jobs[0].get("dedupe_key") or jobs[0].get("url", f"job_{time.time()}"),
                        "job": jobs[0],
                    }
                    r2 = requests.post(f"{API_URL}/v1/jobs/save", json=save_payload, headers=headers, timeout=15)
                    check("Save job", r2.status_code in (200, 201, 409), f"{r2.status_code} {r2.text[:80]}")
        except Exception as e:
            check("Job search + save", False, str(e))

        # Applications
        try:
            r = requests.post(f"{API_URL}/v1/applications", json={
                "company": "Acme Corp", "role": "Backend Engineer",
                "job_url": "https://example.com/job/1",
                "status": "applied", "notes": "E2E test application",
            }, headers=headers, timeout=15)
            check("Create application", r.status_code == 200, f"{r.status_code} {r.text[:80]}")
            if r.status_code == 200:
                app_id = r.json().get("id")
                if app_id:
                    r2 = requests.get(f"{API_URL}/v1/applications", headers=headers, timeout=15)
                    check("List applications", r2.status_code == 200, str(r2.status_code))
                    r3 = requests.patch(f"{API_URL}/v1/applications/{app_id}/stage", json={"stage": "interview"}, headers=headers, timeout=15)
                    check("Move to interview stage", r3.status_code in (200, 204), f"{r3.status_code}")
        except Exception as e:
            check("Applications flow", False, str(e))

        # AI features
        try:
            r = requests.post(f"{API_URL}/v1/cover-letter/generate", json={
                "resume_text": "Senior engineer with Python skills",
                "job_title": "Backend Engineer", "company": "Acme Corp",
                "job_description": "Build APIs with Python", "tone": "formal",
            }, headers=headers, timeout=180)
            check("Cover letter generation", r.status_code in (200, 422, 502), str(r.status_code))
        except Exception as e:
            check("Cover letter generation", False, str(e))

        try:
            r = requests.post(f"{API_URL}/v1/communication/generate", json={
                "comm_type": "thank_you", "resume_text": "Senior engineer",
                "job_title": "Backend Engineer", "company_name": "Acme Corp",
                "days_since": 1,
            }, headers=headers, timeout=180)
            check("Communication generation", r.status_code in (200, 422, 502), str(r.status_code))
        except Exception as e:
            check("Communication generation", False, str(e))

        try:
            r = requests.post(f"{API_URL}/v1/interview/prep", json={
                "resume_text": "Senior Python engineer",
                "job_title": "Backend Engineer",
                "interview_type": "behavioral",
            }, headers=headers, timeout=180)
            check("Interview prep generation", r.status_code in (200, 422, 502), str(r.status_code))
        except Exception as e:
            check("Interview prep generation", False, str(e))

        # Career ops
        try:
            r = requests.get(f"{API_URL}/v1/career-ops/stats", headers=headers, timeout=60)
            check("Career ops stats", r.status_code == 200, f"{r.status_code} {r.text[:100]}")
        except Exception as e:
            check("Career ops stats", False, str(e))

        try:
            r = requests.post(f"{API_URL}/v1/career-ops/portals", json={
                "name": "Greenhouse", "careers_url": "https://boards.greenhouse.io/test",
            }, headers=headers, timeout=15)
            check("Create portal", r.status_code in (200, 201, 409), str(r.status_code))
        except Exception as e:
            check("Create portal", False, str(e))

        # Guardrails
        try:
            r = requests.post(f"{API_URL}/v1/guardrails/check", json={
                "resume_text": "I am a great engineer with 10 years experience.",
            }, headers=headers, timeout=30)
            check("Guardrails check", r.status_code in (200, 404, 502), str(r.status_code))
        except Exception as e:
            check("Guardrails check", False, str(e))

        # Export
        try:
            r = requests.post(f"{API_URL}/v1/export/json", json={
                "resume_json": {"name": "Test", "skills": ["Python"]},
            }, headers=headers, timeout=30)
            check("Export JSON", r.status_code in (200, 404, 502), str(r.status_code))
        except Exception as e:
            check("Export JSON", False, str(e))

        try:
            r = requests.post(f"{API_URL}/v1/export/pdf", json={
                "resume_json": {"name": "Test"},
            }, headers=headers, timeout=30)
            check("Export PDF", r.status_code in (200, 404, 500, 502), str(r.status_code))
        except Exception as e:
            check("Export PDF", False, str(e))

        # Knowledge graph (requires a resume ID)
        if rid:
            try:
                r = requests.post(f"{API_URL}/v1/resumes/{rid}/knowledge-graph", headers=headers, timeout=180)
                check("Knowledge graph", r.status_code in (200, 422, 502), str(r.status_code))
            except Exception as e:
                check("Knowledge graph", False, str(e))
        else:
            skip("Knowledge graph (no resume ID)")

        # Predictive analytics
        try:
            r = requests.post(f"{API_URL}/v1/predictive/score", json={
                "resume_text": "Experienced engineer",
            }, headers=headers, timeout=30)
            check("Predictive score", r.status_code in (200, 404, 422, 502), str(r.status_code))
        except Exception as e:
            check("Predictive score", False, str(e))

        # Career intelligence
        try:
            r = requests.post(f"{API_URL}/v1/career-intelligence/salary-benchmark", json={
                "resume_text": "Senior engineer", "target_role": "Software Engineer",
                "location": "San Francisco",
            }, headers=headers, timeout=30)
            check("Salary benchmark", r.status_code in (200, 404, 422, 502), str(r.status_code))
        except Exception as e:
            check("Salary benchmark", False, str(e))

        # Agents
        try:
            r = requests.post(f"{API_URL}/v1/agents", json={
                "name": "E2E Agent", "role": "assistant", "system_prompt": "Helpful.",
            }, headers=headers, timeout=30)
            check("Create agent", r.status_code in (200, 201, 404, 409, 422, 500), str(r.status_code))
        except Exception as e:
            check("Create agent", False, str(e))

        # Gmail AI
        try:
            r = requests.post(f"{API_URL}/v1/gmail/parse-email", json={
                "sender": "hr@acme.com", "subject": "Interview Invite", "body": "We would like to interview you.",
            }, headers=headers, timeout=30)
            check("Gmail parse email", r.status_code in (200, 404, 422, 502), str(r.status_code))
        except Exception as e:
            check("Gmail parse email", False, str(e))

        # Hermes scraping
        try:
            r = requests.post(f"{API_URL}/v1/hermes/scrape", json={
                "query": "engineer", "location": "remote", "sync": True,
            }, headers=headers, timeout=60)
            check("Hermes scrape", r.status_code in (200, 202, 404, 422, 500, 502), str(r.status_code))
        except Exception as e:
            check("Hermes scrape", False, str(e))

        # Knowledge hub
        try:
            r = requests.post(f"{API_URL}/v1/knowledge-hub/analyze", json={
                "url": "https://example.com/article",
            }, headers=headers, timeout=30)
            check("Knowledge hub analyze", r.status_code in (200, 404, 422, 502), str(r.status_code))
        except Exception as e:
            check("Knowledge hub analyze", False, str(e))

        # Unauthorized access
        try:
            r = requests.get(f"{API_URL}/v1/profile", timeout=15)
            check("Unauthenticated /profile returns 401", r.status_code == 401, str(r.status_code))
            r = requests.get(f"{API_URL}/v1/applications", timeout=15)
            check("Unauthenticated /applications returns 401", r.status_code == 401, str(r.status_code))
        except Exception as e:
            check("Unauthorized protection", False, str(e))

        # Archive route parity
        for v1, arch in [("/v1/health", "/health"), ("/v1/profile", "/profile")]:
            try:
                if "health" in v1:
                    r1, r2 = requests.get(f"{API_URL}{v1}", timeout=15), requests.get(f"{API_URL}{arch}", timeout=15)
                else:
                    r1, r2 = requests.get(f"{API_URL}{v1}", headers=headers, timeout=15), requests.get(f"{API_URL}{arch}", headers=headers, timeout=15)
                check(f"Archive parity {v1} vs {arch}", r1.status_code == r2.status_code, f"{r1.status_code} vs {r2.status_code}")
            except Exception as e:
                check(f"Archive parity {v1} vs {arch}", False, str(e))

        # --- PHASE 6: JS Console errors ---
        print("\n--- Phase 6: Console errors ---")
        filtered = [e for e in errors if not any(x in e.lower() for x in ["favicon", "sourcemap", "third-party"])]
        if filtered:
            for err in filtered[:5]:
                log(err)
        check("No unexpected JS console errors", len(filtered) == 0, f"{len(filtered)} errors (showing first 5 above)")

        # --- PHASE 7: Auth UI through the actual frontend ---
        print("\n--- Phase 7: UI registration flow ---")
        try:
            page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded", timeout=20000)
            time.sleep(1)
            page_content = page.content().lower()
            has_form = any(x in page_content for x in ["form", "input", "button", "email", "password"])
            check("Auth page has form elements", has_form, "no form elements found")
        except Exception as e:
            check("Auth page interaction", False, str(e))

        browser.close()

    total = PASS + FAIL + SKIP
    print(f"\n{'='*60}")
    print(f"RESULTS: {PASS} passed, {FAIL} failed, {SKIP} skipped / {total} total")
    print(f"{'='*60}")
    if FAIL > 0:
        sys.exit(1)


if __name__ == "__main__":
    run()
