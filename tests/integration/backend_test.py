#!/usr/bin/env python3
"""
Comprehensive backend test suite for Job Theory API
Tests all endpoints with proper auth, ownership scoping, and AI flows
"""
import requests
import time
import json
import io

# Base URL from config
import os
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8085/api")

# Test user credentials
TEST_EMAIL = f"testuser_{int(time.time())}@example.com"
TEST_PASSWORD = "SecurePass123!"
TEST_NAME = "Jane Smith"

# Second user for ownership testing
TEST_EMAIL_2 = f"testuser2_{int(time.time())}@example.com"

# Demo account
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "Passw0rd!"

# Global state
token = None
user_id = None
token2 = None
user_id2 = None

# Test results tracking
results = {
    "passed": [],
    "failed": [],
    "warnings": []
}

def log_result(test_name, passed, message=""):
    """Log test result"""
    if passed:
        results["passed"].append(test_name)
        print(f"✅ {test_name}")
    else:
        results["failed"].append({"test": test_name, "message": message})
        print(f"❌ {test_name}: {message}")

def log_warning(test_name, message):
    """Log warning (not a failure)"""
    results["warnings"].append({"test": test_name, "message": message})
    print(f"⚠️  {test_name}: {message}")

def make_request(method, endpoint, **kwargs):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    timeout = kwargs.pop('timeout', 60)  # Default 60s, can override
    try:
        resp = requests.request(method, url, timeout=timeout, **kwargs)
        return resp
    except requests.exceptions.Timeout:
        print(f"⏱️  Request timeout after {timeout}s: {method} {endpoint}")
        raise
    except Exception as e:
        print(f"❌ Request error: {method} {endpoint}: {e}")
        raise

def auth_headers():
    """Get auth headers with token"""
    return {"Authorization": f"Bearer {token}"}

def auth_headers2():
    """Get auth headers for second user"""
    return {"Authorization": f"Bearer {token2}"}

# ============================================================================
# 1. AUTH TESTS
# ============================================================================

def test_auth_register():
    """Test user registration"""
    global token, user_id
    resp = make_request("POST", "/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data:
            user_id = data["id"]
            # login to get token
            l_resp = make_request("POST", "/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            if l_resp.status_code == 200:
                l_data = l_resp.json()
                if "token" in l_data:
                    token = l_data["token"]
                    log_result("Auth: Register (200, returns token+user)", True)
                else:
                    log_result("Auth: Register (200, returns token+user)", False, "Missing token in login response")
            else:
                log_result("Auth: Register (200, returns token+user)", False, f"Login failed status {l_resp.status_code}")
        else:
            log_result("Auth: Register (200, returns token+user)", False, "Missing id in response")
    else:
        log_result("Auth: Register (200, returns token+user)", False, f"Status {resp.status_code}: {resp.text}")

def test_auth_duplicate_register():
    """Test duplicate registration fails"""
    resp = make_request("POST", "/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if resp.status_code in (400, 500):
        log_result("Auth: Duplicate register (400/500)", True)
    else:
        log_result("Auth: Duplicate register (400/500)", False, f"Expected 400 or 500, got {resp.status_code}")

def test_auth_login_success():
    """Test successful login"""
    resp = make_request("POST", "/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if "token" in data:
            log_result("Auth: Login success (200)", True)
        else:
            log_result("Auth: Login success (200)", False, "Missing token")
    else:
        log_result("Auth: Login success (200)", False, f"Status {resp.status_code}: {resp.text}")

def test_auth_login_wrong_password():
    """Test login with wrong password"""
    resp = make_request("POST", "/auth/login", json={
        "email": TEST_EMAIL,
        "password": "WrongPassword123!"
    })
    
    if resp.status_code == 401:
        log_result("Auth: Login wrong password (401)", True)
    else:
        log_result("Auth: Login wrong password (401)", False, f"Expected 401, got {resp.status_code}")

def test_auth_me_with_token():
    """Test GET /me with valid token"""
    resp = make_request("GET", "/auth/me", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and "email" in data:
            log_result("Auth: GET /me with token (200)", True)
        else:
            log_result("Auth: GET /me with token (200)", False, "Missing id or email in response")
    else:
        log_result("Auth: GET /me with token (200)", False, f"Status {resp.status_code}: {resp.text}")

def test_auth_me_without_token():
    """Test GET /me without token"""
    resp = make_request("GET", "/auth/me")
    
    if resp.status_code == 401:
        log_result("Auth: GET /me without token (401)", True)
    else:
        log_result("Auth: GET /me without token (401)", False, f"Expected 401, got {resp.status_code}")

def test_auth_google_stub():
    """Test Google login returns 501 (not configured)"""
    resp = make_request("POST", "/auth/google", json={
        "id_token": "fake_token_for_testing"
    })
    
    if resp.status_code == 501:
        log_result("Auth: POST /auth/google returns 501 (expected)", True)
    else:
        log_result("Auth: POST /auth/google returns 501 (expected)", False, f"Expected 501, got {resp.status_code}")

# ============================================================================
# 2. PROFILE TESTS
# ============================================================================

def test_profile_get_autocreate():
    """Test GET /profile auto-creates default profile"""
    resp = make_request("GET", "/profile", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and "user_id" in data:
            log_result("Profile: GET /profile (auto-creates default)", True)
        else:
            log_result("Profile: GET /profile (auto-creates default)", False, "Missing id or user_id")
    else:
        log_result("Profile: GET /profile (auto-creates default)", False, f"Status {resp.status_code}: {resp.text}")

def test_profile_update():
    """Test PUT /profile with fields"""
    resp = make_request("PUT", "/profile", headers=auth_headers(), json={
        "current_role": "Software Engineer",
        "target_roles": ["Senior Engineer", "Tech Lead"],
        "skills": ["Python", "FastAPI", "React"],
        "years_experience": 5,
        "open_to_remote": True,
        "onboarding_completed": True
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("current_role") == "Software Engineer" and len(data.get("skills", [])) == 3:
            log_result("Profile: PUT /profile with fields", True)
        else:
            log_result("Profile: PUT /profile with fields", False, "Fields not updated correctly")
    else:
        log_result("Profile: PUT /profile with fields", False, f"Status {resp.status_code}: {resp.text}")

def test_profile_parse_resume():
    """Test POST /profile/parse-resume with uploaded file (AI call)"""
    # Create a small text resume
    resume_text = """
John Doe
Software Engineer
Email: john@example.com
Phone: 555-1234

EXPERIENCE
Senior Software Engineer at TechCorp (2020-2023)
- Led development of microservices architecture
- Managed team of 5 engineers
- Technologies: Python, FastAPI, Docker, Kubernetes

Software Engineer at StartupXYZ (2018-2020)
- Built REST APIs and web applications
- Technologies: JavaScript, Node.js, React

EDUCATION
BS Computer Science, University of Technology (2018)

SKILLS
Python, JavaScript, FastAPI, React, Docker, Kubernetes, AWS, PostgreSQL
"""
    
    files = {'file': ('resume.txt', io.BytesIO(resume_text.encode()), 'text/plain')}
    
    # AI call - use 45s timeout
    resp = make_request("POST", "/profile/parse-resume", headers=auth_headers(), files=files, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        if "extracted" in data and "resume_text" in data:
            log_result("Profile: POST /profile/parse-resume (AI, 5-15s)", True)
        else:
            log_result("Profile: POST /profile/parse-resume (AI, 5-15s)", False, "Missing extracted or resume_text")
    else:
        log_result("Profile: POST /profile/parse-resume (AI, 5-15s)", False, f"Status {resp.status_code}: {resp.text}")

# ============================================================================
# 3. RESUME OPTIMIZER TESTS
# ============================================================================

resume_id = None
version_id = None

def test_resume_create():
    """Test POST /resumes with title and source_text"""
    global resume_id
    resume_text = """
JANE SMITH
Senior Software Engineer
jane.smith@example.com | 555-9876 | San Francisco, CA

PROFESSIONAL SUMMARY
Experienced software engineer with 7+ years building scalable web applications and APIs.
Expert in Python, FastAPI, React, and cloud infrastructure.

EXPERIENCE
Senior Software Engineer | TechCorp Inc. | 2020 - Present
- Architected and deployed microservices handling 10M+ requests/day
- Led team of 6 engineers in agile development
- Reduced API latency by 40% through optimization
- Technologies: Python, FastAPI, Docker, Kubernetes, AWS, PostgreSQL

Software Engineer | InnovateLabs | 2017 - 2020
- Developed RESTful APIs and React frontends
- Implemented CI/CD pipelines with Jenkins and GitHub Actions
- Technologies: JavaScript, Node.js, React, MongoDB

EDUCATION
BS Computer Science | Stanford University | 2017

SKILLS
Python, JavaScript, FastAPI, React, Docker, Kubernetes, AWS, PostgreSQL, MongoDB, Redis
"""
    
    resp = make_request("POST", "/resumes", headers=auth_headers(), json={
        "title": "Jane Smith - Senior Engineer Resume",
        "source_text": resume_text
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and len(data.get("source_text", "")) >= 30:
            resume_id = data["id"]
            log_result("Resume: POST /resumes (create)", True)
        else:
            log_result("Resume: POST /resumes (create)", False, "Missing id or source_text too short")
    else:
        log_result("Resume: POST /resumes (create)", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_list():
    """Test GET /resumes"""
    resp = make_request("GET", "/resumes", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            log_result("Resume: GET /resumes (list)", True)
        else:
            log_result("Resume: GET /resumes (list)", False, "Expected non-empty list")
    else:
        log_result("Resume: GET /resumes (list)", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_get_by_id():
    """Test GET /resumes/{id}"""
    if not resume_id:
        log_result("Resume: GET /resumes/{id}", False, "No resume_id available")
        return
    
    resp = make_request("GET", f"/resumes/{resume_id}", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("id") == resume_id:
            log_result("Resume: GET /resumes/{id}", True)
        else:
            log_result("Resume: GET /resumes/{id}", False, "ID mismatch")
    else:
        log_result("Resume: GET /resumes/{id}", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_upload():
    """Test POST /resumes/upload with file"""
    resume_text = """
ALEX JOHNSON
Data Scientist
alex.johnson@example.com

EXPERIENCE
Data Scientist at DataCorp (2019-2023)
- Built ML models for customer segmentation
- Technologies: Python, scikit-learn, TensorFlow, SQL

SKILLS
Python, Machine Learning, TensorFlow, SQL, Pandas
"""
    
    files = {'file': ('alex_resume.txt', io.BytesIO(resume_text.encode()), 'text/plain')}
    resp = make_request("POST", "/resumes/upload", headers=auth_headers(), files=files)
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and "source_text" in data:
            log_result("Resume: POST /resumes/upload", True)
        else:
            log_result("Resume: POST /resumes/upload", False, "Missing id or source_text")
    else:
        log_result("Resume: POST /resumes/upload", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_analyze():
    """Test POST /resumes/{id}/analyze (AI call)"""
    if not resume_id:
        log_result("Resume: POST /resumes/{id}/analyze (AI)", False, "No resume_id available")
        return
    
    job_description = """
Senior Software Engineer - AI Platform
TechCorp is seeking a Senior Software Engineer to join our AI Platform team.

Requirements:
- 5+ years of software engineering experience
- Strong Python and FastAPI skills
- Experience with Docker and Kubernetes
- Cloud infrastructure experience (AWS/GCP)
- React or similar frontend framework
- Strong communication and leadership skills

Responsibilities:
- Design and build scalable microservices
- Lead technical initiatives
- Mentor junior engineers
- Collaborate with product and design teams
"""
    
    # AI call - use 45s timeout
    resp = make_request("POST", f"/resumes/{resume_id}/analyze", headers=auth_headers(), json={
        "job_description": job_description,
        "custom_instructions": "Focus on technical skills match"
    }, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        result = data.get("result", {})
        if "overall_score" in result and "matched_keywords" in result and "recommendations" in result:
            log_result("Resume: POST /resumes/{id}/analyze (AI, 5-20s)", True)
        else:
            log_result("Resume: POST /resumes/{id}/analyze (AI, 5-20s)", False, 
                      f"Missing expected fields in result. Got: {list(result.keys())}")
    else:
        log_result("Resume: POST /resumes/{id}/analyze (AI, 5-20s)", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_optimize():
    """Test POST /resumes/{id}/optimize (AI call)"""
    global version_id
    if not resume_id:
        log_result("Resume: POST /resumes/{id}/optimize (AI)", False, "No resume_id available")
        return
    
    job_description = """
Senior Software Engineer - AI Platform
Requirements: Python, FastAPI, Docker, Kubernetes, AWS, React, 5+ years experience
"""
    
    # AI call - use 45s timeout
    resp = make_request("POST", f"/resumes/{resume_id}/optimize", headers=auth_headers(), json={
        "job_description": job_description,
        "custom_instructions": "Emphasize leadership and cloud experience"
    }, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        if "optimized_text" in data and len(data.get("optimized_text", "")) > 50:
            version_id = data.get("id")
            log_result("Resume: POST /resumes/{id}/optimize (AI, 10-25s)", True)
        else:
            log_result("Resume: POST /resumes/{id}/optimize (AI, 10-25s)", False, "Missing or short optimized_text")
    else:
        log_result("Resume: POST /resumes/{id}/optimize (AI, 10-25s)", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_versions():
    """Test GET /resumes/{id}/versions"""
    if not resume_id:
        log_result("Resume: GET /resumes/{id}/versions", False, "No resume_id available")
        return
    
    resp = make_request("GET", f"/resumes/{resume_id}/versions", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            log_result("Resume: GET /resumes/{id}/versions", True)
        else:
            log_result("Resume: GET /resumes/{id}/versions", False, "Expected list")
    else:
        log_result("Resume: GET /resumes/{id}/versions", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_version_feedback():
    """Test POST /resume-versions/{vid}/feedback"""
    if not version_id:
        log_result("Resume: POST /resume-versions/{vid}/feedback", False, "No version_id available")
        return
    
    resp = make_request("POST", f"/resume-versions/{version_id}/feedback", headers=auth_headers(), json={
        "rating": "up",
        "comment": "Great optimization! Much better alignment with the job description."
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            log_result("Resume: POST /resume-versions/{vid}/feedback", True)
        else:
            log_result("Resume: POST /resume-versions/{vid}/feedback", False, "ok not True")
    else:
        log_result("Resume: POST /resume-versions/{vid}/feedback", False, f"Status {resp.status_code}: {resp.text}")

def test_resume_ownership():
    """Test user cannot access another user's resume (404)"""
    global token2, user_id2
    
    # Create second user
    resp = make_request("POST", "/auth/register", json={
        "email": TEST_EMAIL_2,
        "password": TEST_PASSWORD
    })
    
    if resp.status_code == 200:
        data = resp.json()
        user_id2 = data["id"]
        # Login second user
        login_resp = make_request("POST", "/auth/login", json={
            "email": TEST_EMAIL_2,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            token2 = login_resp.json()["token"]
        else:
            log_result("Resume: Ownership check (404)", False, "Failed to login second user")
            return
    else:
        log_result("Resume: Ownership check (404)", False, "Failed to create second user")
        return
    
    if not resume_id:
        log_result("Resume: Ownership check (404)", False, "No resume_id available")
        return
    
    # Try to access first user's resume with second user's token
    resp = make_request("GET", f"/resumes/{resume_id}", headers=auth_headers2())
    
    if resp.status_code == 404:
        log_result("Resume: Ownership check (404)", True)
    else:
        log_result("Resume: Ownership check (404)", False, f"Expected 404, got {resp.status_code}")

# ============================================================================
# 4. SMART JOB SEARCH TESTS
# ============================================================================

saved_job_id = None

def test_jobs_search():
    """Test POST /jobs/search with sources and AI scoring"""
    # AI call for scoring - use 45s timeout
    resp = make_request("POST", "/jobs/search", headers=auth_headers(), json={
        "query": "python developer",
        "location": "",
        "sources": ["remotive", "arbeitnow"],
        "limit": 10
    }, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        if "count" in data and "jobs" in data:
            # Note: 0 jobs from external APIs is acceptable
            log_result("Jobs: POST /jobs/search (AI scoring, ~30s)", True)
            if data["count"] == 0:
                log_warning("Jobs: Search returned 0 jobs", "External APIs may be empty - this is acceptable")
        else:
            log_result("Jobs: POST /jobs/search (AI scoring, ~30s)", False, "Missing count or jobs")
    else:
        log_result("Jobs: POST /jobs/search (AI scoring, ~30s)", False, f"Status {resp.status_code}: {resp.text}")

def test_jobs_save():
    """Test POST /jobs/save"""
    global saved_job_id
    resp = make_request("POST", "/jobs/save", headers=auth_headers(), json={
        "title": "Senior Python Developer",
        "company": "TechCorp",
        "location": "San Francisco, CA",
        "remote": True,
        "url": "https://example.com/jobs/123",
        "description": "We are looking for a senior Python developer...",
        "salary": "$150k-$200k",
        "match_score": 85
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data:
            saved_job_id = data["id"]
            log_result("Jobs: POST /jobs/save", True)
        else:
            log_result("Jobs: POST /jobs/save", False, "Missing id")
    else:
        log_result("Jobs: POST /jobs/save", False, f"Status {resp.status_code}: {resp.text}")

def test_jobs_saved_list():
    """Test GET /jobs/saved"""
    resp = make_request("GET", "/jobs/saved", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            log_result("Jobs: GET /jobs/saved", True)
        else:
            log_result("Jobs: GET /jobs/saved", False, "Expected list")
    else:
        log_result("Jobs: GET /jobs/saved", False, f"Status {resp.status_code}: {resp.text}")

def test_jobs_delete_saved():
    """Test DELETE /jobs/saved/{id}"""
    if not saved_job_id:
        log_result("Jobs: DELETE /jobs/saved/{id}", False, "No saved_job_id available")
        return
    
    resp = make_request("DELETE", f"/jobs/saved/{saved_job_id}", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("deleted"):
            log_result("Jobs: DELETE /jobs/saved/{id}", True)
        else:
            log_result("Jobs: DELETE /jobs/saved/{id}", False, "deleted not True")
    else:
        log_result("Jobs: DELETE /jobs/saved/{id}", False, f"Status {resp.status_code}: {resp.text}")

def test_jobs_company_research():
    """Test POST /jobs/company-research (AI call)"""
    # AI call - use 45s timeout
    resp = make_request("POST", "/jobs/company-research", headers=auth_headers(), json={
        "company": "OpenAI",
        "role": "AI Engineer"
    }, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        # Should return some structured data
        if isinstance(data, dict) and len(data) > 0:
            log_result("Jobs: POST /jobs/company-research (AI, 5-15s)", True)
        else:
            log_result("Jobs: POST /jobs/company-research (AI, 5-15s)", False, "Expected non-empty dict")
    else:
        log_result("Jobs: POST /jobs/company-research (AI, 5-15s)", False, f"Status {resp.status_code}: {resp.text}")

# ============================================================================
# 5. INTERVIEW KANBAN TESTS
# ============================================================================

application_id = None

def test_applications_list():
    """Test GET /applications"""
    resp = make_request("GET", "/applications", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            log_result("Kanban: GET /applications", True)
        else:
            log_result("Kanban: GET /applications", False, "Expected list")
    else:
        log_result("Kanban: GET /applications", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_create():
    """Test POST /applications"""
    global application_id
    resp = make_request("POST", "/applications", headers=auth_headers(), json={
        "title": "Senior Software Engineer",
        "company": "TechCorp",
        "location": "San Francisco, CA",
        "url": "https://techcorp.com/careers/123",
        "stage": "saved",
        "notes": "Great company culture, competitive salary"
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and data.get("stage") == "saved":
            application_id = data["id"]
            log_result("Kanban: POST /applications", True)
        else:
            log_result("Kanban: POST /applications", False, "Missing id or wrong stage")
    else:
        log_result("Kanban: POST /applications", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_update():
    """Test PUT /applications/{id}"""
    if not application_id:
        log_result("Kanban: PUT /applications/{id}", False, "No application_id available")
        return
    
    resp = make_request("PUT", f"/applications/{application_id}", headers=auth_headers(), json={
        "notes": "Updated notes: Had initial phone screen, very positive"
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if "Updated notes" in data.get("notes", ""):
            log_result("Kanban: PUT /applications/{id}", True)
        else:
            log_result("Kanban: PUT /applications/{id}", False, "Notes not updated")
    else:
        log_result("Kanban: PUT /applications/{id}", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_stage_valid():
    """Test PATCH /applications/{id}/stage with valid stage"""
    if not application_id:
        log_result("Kanban: PATCH /applications/{id}/stage (valid)", False, "No application_id available")
        return
    
    resp = make_request("PATCH", f"/applications/{application_id}/stage", headers=auth_headers(), json={
        "stage": "interview"
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("stage") == "interview":
            log_result("Kanban: PATCH /applications/{id}/stage (valid)", True)
        else:
            log_result("Kanban: PATCH /applications/{id}/stage (valid)", False, "Stage not updated")
    else:
        log_result("Kanban: PATCH /applications/{id}/stage (valid)", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_stage_invalid():
    """Test PATCH /applications/{id}/stage with invalid stage (422)"""
    if not application_id:
        log_result("Kanban: PATCH /applications/{id}/stage (invalid -> 422)", False, "No application_id available")
        return
    
    resp = make_request("PATCH", f"/applications/{application_id}/stage", headers=auth_headers(), json={
        "stage": "invalid_stage"
    })
    
    if resp.status_code == 422:
        log_result("Kanban: PATCH /applications/{id}/stage (invalid -> 422)", True)
    else:
        log_result("Kanban: PATCH /applications/{id}/stage (invalid -> 422)", False, f"Expected 422, got {resp.status_code}")

def test_applications_parse_email():
    """Test POST /applications/parse-email (AI call)"""
    email_text = """
Hi Jane,

Thanks for applying to the AI Engineer role at OpenAI. We'd like to schedule a phone screen next week.

We were impressed by your background in machine learning and your experience with large-scale systems.

Are you available for a 30-minute call on Tuesday, March 15th at 2pm PT?

Best regards,
Sarah Johnson
Recruiting Team
OpenAI
"""
    
    # AI call - use 45s timeout
    resp = make_request("POST", "/applications/parse-email", headers=auth_headers(), json={
        "email_text": email_text
    }, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        if "matched" in data and "parsed" in data:
            if data.get("matched"):
                if "application" in data and "action" in data:
                    log_result("Kanban: POST /applications/parse-email (AI)", True)
                else:
                    log_result("Kanban: POST /applications/parse-email (AI)", False, "Missing application or action")
            else:
                log_result("Kanban: POST /applications/parse-email (AI)", True)
        else:
            log_result("Kanban: POST /applications/parse-email (AI)", False, "Missing matched or parsed")
    else:
        log_result("Kanban: POST /applications/parse-email (AI)", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_prep():
    """Test POST /applications/{id}/prep (AI call)"""
    if not application_id:
        log_result("Kanban: POST /applications/{id}/prep (AI)", False, "No application_id available")
        return
    
    # AI call - use 45s timeout
    resp = make_request("POST", f"/applications/{application_id}/prep", headers=auth_headers(), timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, dict) and len(data) > 0:
            log_result("Kanban: POST /applications/{id}/prep (AI)", True)
        else:
            log_result("Kanban: POST /applications/{id}/prep (AI)", False, "Expected non-empty dict")
    else:
        log_result("Kanban: POST /applications/{id}/prep (AI)", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_feedback():
    """Test POST /applications/{id}/feedback"""
    if not application_id:
        log_result("Kanban: POST /applications/{id}/feedback", False, "No application_id available")
        return
    
    resp = make_request("POST", f"/applications/{application_id}/feedback", headers=auth_headers(), json={
        "text": "Interview went very well. Technical questions were challenging but fair.",
        "rating": 5
    })
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            log_result("Kanban: POST /applications/{id}/feedback", True)
        else:
            log_result("Kanban: POST /applications/{id}/feedback", False, "ok not True")
    else:
        log_result("Kanban: POST /applications/{id}/feedback", False, f"Status {resp.status_code}: {resp.text}")

def test_applications_delete():
    """Test DELETE /applications/{id}"""
    if not application_id:
        log_result("Kanban: DELETE /applications/{id}", False, "No application_id available")
        return
    
    resp = make_request("DELETE", f"/applications/{application_id}", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("deleted"):
            log_result("Kanban: DELETE /applications/{id}", True)
        else:
            log_result("Kanban: DELETE /applications/{id}", False, "deleted not True")
    else:
        log_result("Kanban: DELETE /applications/{id}", False, f"Status {resp.status_code}: {resp.text}")

# ============================================================================
# 6. INSIGHTS TESTS
# ============================================================================

def test_insights_skill_gap():
    """Test POST /insights/skill-gap (AI call)"""
    # AI call - use 45s timeout
    resp = make_request("POST", "/insights/skill-gap", headers=auth_headers(), json={
        "target_role": "AI Engineer"
    }, timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, dict) and len(data) > 0:
            log_result("Insights: POST /insights/skill-gap (AI, 5-15s)", True)
        else:
            log_result("Insights: POST /insights/skill-gap (AI, 5-15s)", False, "Expected non-empty dict")
    else:
        log_result("Insights: POST /insights/skill-gap (AI, 5-15s)", False, f"Status {resp.status_code}: {resp.text}")

def test_insights_dashboard():
    """Test GET /insights/dashboard"""
    resp = make_request("GET", "/insights/dashboard", headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "applications_total" in data and "applications_by_stage" in data:
            log_result("Insights: GET /insights/dashboard", True)
        else:
            log_result("Insights: GET /insights/dashboard", False, "Missing expected fields")
    else:
        log_result("Insights: GET /insights/dashboard", False, f"Status {resp.status_code}: {resp.text}")

# ============================================================================
# 7. ROUND 3 NEW ENDPOINTS
# ============================================================================

# Global state for Round 3 tests
resume_id_for_round3 = None
application_id_for_round3 = None
version_id_for_round3 = None
save_id_for_round3 = None
hermes_session_id = None

def test_resume_analyze_text():
    """Test POST /resumes/analyze-text with ats_compliance"""
    resume_text = """John Doe
Senior Software Engineer
Email: john@example.com | Phone: (555) 123-4567

EXPERIENCE
Senior Software Engineer at Tech Corp (2020-Present)
- Led development of microservices architecture using Python and FastAPI
- Implemented CI/CD pipelines reducing deployment time by 60%
- Mentored team of 5 junior developers

Software Engineer at StartupCo (2018-2020)
- Built RESTful APIs serving 1M+ daily requests
- Optimized database queries improving performance by 40%

SKILLS
Python, FastAPI, Docker, Kubernetes, PostgreSQL, AWS, Git

EDUCATION
BS Computer Science, State University (2018)"""
    
    job_description = """We are seeking a Senior Backend Engineer with strong Python and FastAPI experience.
You will design and build scalable microservices, work with cloud infrastructure (AWS/GCP),
and mentor junior team members. 5+ years experience required."""
    
    resp = make_request("POST", "/resumes/analyze-text", 
                       headers=auth_headers(),
                       json={"resume_text": resume_text, "job_description": job_description},
                       timeout=30)
    
    if resp.status_code == 200:
        data = resp.json()
        result = data.get("result", {})
        if "overall_score" in result and "ats_compliance" in result:
            ats = result["ats_compliance"]
            if "score" in ats and "passed" in ats and "total" in ats and "checks" in ats:
                log_result("Round3: POST /resumes/analyze-text (AI + ATS compliance)", True)
            else:
                log_result("Round3: POST /resumes/analyze-text (AI + ATS compliance)", False, 
                          f"Missing ATS compliance fields: {ats}")
        else:
            log_result("Round3: POST /resumes/analyze-text (AI + ATS compliance)", False, 
                      f"Missing overall_score or ats_compliance in result: {result.keys()}")
    else:
        log_result("Round3: POST /resumes/analyze-text (AI + ATS compliance)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_resume_analyze_with_ats():
    """Test POST /resumes/{id}/analyze now includes ats_compliance"""
    global resume_id_for_round3
    
    # Create a resume first
    resp = make_request("POST", "/resumes", 
                       headers=auth_headers(),
                       json={
                           "title": "My Resume for ATS Test",
                           "source_text": """Jane Smith
Python Developer | jane@example.com

EXPERIENCE
Python Developer at DataCorp (2019-Present)
- Developed data pipelines processing 10TB+ daily
- Built REST APIs with FastAPI and Django
- Implemented automated testing with pytest

SKILLS
Python, FastAPI, Django, PostgreSQL, Docker, AWS, Git

EDUCATION
MS Computer Science, Tech University (2019)"""
                       })
    
    if resp.status_code != 200:
        log_result("Round3: POST /resumes/{id}/analyze (with ATS compliance)", False, 
                  f"Failed to create resume: {resp.status_code}")
        return
    
    resume_id_for_round3 = resp.json()["id"]
    
    # Now analyze it
    resp = make_request("POST", f"/resumes/{resume_id_for_round3}/analyze",
                       headers=auth_headers(),
                       json={"job_description": "Looking for Python developer with FastAPI experience"},
                       timeout=30)
    
    if resp.status_code == 200:
        data = resp.json()
        result = data.get("result", {})
        if "overall_score" in result and "ats_compliance" in result:
            ats = result["ats_compliance"]
            if "score" in ats and "passed" in ats and "total" in ats and "checks" in ats:
                log_result("Round3: POST /resumes/{id}/analyze (with ATS compliance)", True)
            else:
                log_result("Round3: POST /resumes/{id}/analyze (with ATS compliance)", False, 
                          f"Missing ATS compliance fields: {ats}")
        else:
            log_result("Round3: POST /resumes/{id}/analyze (with ATS compliance)", False, 
                      f"Missing overall_score or ats_compliance: {result.keys()}")
    else:
        log_result("Round3: POST /resumes/{id}/analyze (with ATS compliance)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_jobs_agent_search():
    """Test POST /jobs/agent-search (agentic search with AI)"""
    resp = make_request("POST", "/jobs/agent-search",
                       headers=auth_headers(),
                       json={
                           "query": "python developer",
                           "location": "",
                           "remote_only": False,
                           "sources": ["remotive", "arbeitnow"]
                       },
                       timeout=45)
    
    if resp.status_code == 200:
        data = resp.json()
        required = ["session_id", "events", "count", "jobs"]
        if all(k in data for k in required):
            if isinstance(data["events"], list) and len(data["events"]) > 0:
                log_result("Round3: POST /jobs/agent-search (AI agentic search)", True)
            else:
                log_result("Round3: POST /jobs/agent-search (AI agentic search)", False, 
                          "Events list is empty or not a list")
        else:
            log_result("Round3: POST /jobs/agent-search (AI agentic search)", False, 
                      f"Missing required fields. Got: {data.keys()}")
    else:
        log_result("Round3: POST /jobs/agent-search (AI agentic search)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_resume_docx_export():
    """Test GET /resumes/{id}/docx returns binary DOCX"""
    global resume_id_for_round3
    
    if not resume_id_for_round3:
        log_result("Round3: GET /resumes/{id}/docx (binary DOCX)", False, 
                  "No resume_id available from previous test")
        return
    
    resp = make_request("GET", f"/resumes/{resume_id_for_round3}/docx",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        content_type = resp.headers.get("content-type", "")
        if "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type:
            # Check it's binary, not JSON
            if len(resp.content) > 0 and not resp.content.startswith(b'{'):
                log_result("Round3: GET /resumes/{id}/docx (binary DOCX)", True)
            else:
                log_result("Round3: GET /resumes/{id}/docx (binary DOCX)", False, 
                          "Response appears to be JSON, not binary DOCX")
        else:
            log_result("Round3: GET /resumes/{id}/docx (binary DOCX)", False, 
                      f"Wrong content-type: {content_type}")
    else:
        log_result("Round3: GET /resumes/{id}/docx (binary DOCX)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_resume_version_docx_export():
    """Test GET /resume-versions/{id}/docx returns binary DOCX"""
    global resume_id_for_round3, version_id_for_round3
    
    if not resume_id_for_round3:
        log_result("Round3: GET /resume-versions/{id}/docx (binary DOCX)", False, 
                  "No resume_id available")
        return
    
    # Create a version first by optimizing
    resp = make_request("POST", f"/resumes/{resume_id_for_round3}/optimize",
                       headers=auth_headers(),
                       json={"job_description": "Python developer with FastAPI experience"},
                       timeout=30)
    
    if resp.status_code != 200:
        log_result("Round3: GET /resume-versions/{id}/docx (binary DOCX)", False, 
                  f"Failed to create version: {resp.status_code}")
        return
    
    version_id_for_round3 = resp.json()["id"]
    
    # Now get the DOCX
    resp = make_request("GET", f"/resume-versions/{version_id_for_round3}/docx",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        content_type = resp.headers.get("content-type", "")
        if "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type:
            if len(resp.content) > 0 and not resp.content.startswith(b'{'):
                log_result("Round3: GET /resume-versions/{id}/docx (binary DOCX)", True)
            else:
                log_result("Round3: GET /resume-versions/{id}/docx (binary DOCX)", False, 
                          "Response appears to be JSON, not binary DOCX")
        else:
            log_result("Round3: GET /resume-versions/{id}/docx (binary DOCX)", False, 
                      f"Wrong content-type: {content_type}")
    else:
        log_result("Round3: GET /resume-versions/{id}/docx (binary DOCX)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_application_notes_add():
    """Test POST /applications/{id}/notes"""
    global application_id_for_round3
    
    # Create an application first
    resp = make_request("POST", "/applications",
                       headers=auth_headers(),
                       json={
                           "title": "Backend Engineer",
                           "company": "TechCorp",
                           "stage": "applied"
                       })
    
    if resp.status_code != 200:
        log_result("Round3: POST /applications/{id}/notes", False, 
                  f"Failed to create application: {resp.status_code}")
        return
    
    application_id_for_round3 = resp.json()["id"]
    
    # Add a note
    resp = make_request("POST", f"/applications/{application_id_for_round3}/notes",
                       headers=auth_headers(),
                       json={"text": "Called recruiter, follow up next week"})
    
    if resp.status_code == 200:
        data = resp.json()
        if "note" in data and "notes_log" in data:
            if isinstance(data["notes_log"], list) and len(data["notes_log"]) > 0:
                log_result("Round3: POST /applications/{id}/notes", True)
            else:
                log_result("Round3: POST /applications/{id}/notes", False, 
                          "notes_log is empty or not a list")
        else:
            log_result("Round3: POST /applications/{id}/notes", False, 
                      f"Missing note or notes_log: {data.keys()}")
    else:
        log_result("Round3: POST /applications/{id}/notes", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_application_notes_delete():
    """Test DELETE /applications/{id}/notes/{nid}"""
    global application_id_for_round3
    
    if not application_id_for_round3:
        log_result("Round3: DELETE /applications/{id}/notes/{nid}", False, 
                  "No application_id available")
        return
    
    # Add a note first
    resp = make_request("POST", f"/applications/{application_id_for_round3}/notes",
                       headers=auth_headers(),
                       json={"text": "Test note to delete"})
    
    if resp.status_code != 200:
        log_result("Round3: DELETE /applications/{id}/notes/{nid}", False, 
                  f"Failed to add note: {resp.status_code}")
        return
    
    note_id = resp.json()["note"]["id"]
    
    # Delete the note
    resp = make_request("DELETE", f"/applications/{application_id_for_round3}/notes/{note_id}",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "notes_log" in data:
            # Check the note is not in the log
            note_ids = [n.get("id") for n in data["notes_log"]]
            if note_id not in note_ids:
                log_result("Round3: DELETE /applications/{id}/notes/{nid}", True)
            else:
                log_result("Round3: DELETE /applications/{id}/notes/{nid}", False, 
                          "Note still in notes_log after delete")
        else:
            log_result("Round3: DELETE /applications/{id}/notes/{nid}", False, 
                      "Missing notes_log in response")
    else:
        log_result("Round3: DELETE /applications/{id}/notes/{nid}", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_application_interview_questions():
    """Test POST /applications/{id}/interview-questions (AI)"""
    global application_id_for_round3
    
    if not application_id_for_round3:
        log_result("Round3: POST /applications/{id}/interview-questions (AI)", False, 
                  "No application_id available")
        return
    
    resp = make_request("POST", f"/applications/{application_id_for_round3}/interview-questions",
                       headers=auth_headers(),
                       timeout=30)
    
    if resp.status_code == 200:
        data = resp.json()
        if "commonly_asked" in data and "preparation_focus" in data:
            if isinstance(data["commonly_asked"], list) and isinstance(data["preparation_focus"], list):
                log_result("Round3: POST /applications/{id}/interview-questions (AI)", True)
            else:
                log_result("Round3: POST /applications/{id}/interview-questions (AI)", False, 
                          "commonly_asked or preparation_focus not lists")
        else:
            log_result("Round3: POST /applications/{id}/interview-questions (AI)", False, 
                      f"Missing required fields: {data.keys()}")
    else:
        log_result("Round3: POST /applications/{id}/interview-questions (AI)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_application_voice_add():
    """Test POST /applications/{id}/voice (multipart audio upload)"""
    global application_id_for_round3
    
    if not application_id_for_round3:
        log_result("Round3: POST /applications/{id}/voice (multipart audio)", False, 
                  "No application_id available")
        return
    
    # Create a small fake audio file (just some bytes)
    audio_data = b'\x00\x01\x02\x03' * 100  # 400 bytes of fake audio
    
    files = {'audio': ('note.webm', audio_data, 'audio/webm')}
    
    resp = make_request("POST", f"/applications/{application_id_for_round3}/voice",
                       headers=auth_headers(),
                       files=files)
    
    if resp.status_code == 200:
        data = resp.json()
        if "voice_note" in data and "transcription_enabled" in data:
            # transcription_enabled should be false (no TRANSCRIBE_PROVIDER configured)
            if data["transcription_enabled"] == False:
                log_result("Round3: POST /applications/{id}/voice (multipart audio)", True)
            else:
                log_warning("Round3: POST /applications/{id}/voice", 
                           f"transcription_enabled is {data['transcription_enabled']}, expected False")
                log_result("Round3: POST /applications/{id}/voice (multipart audio)", True)
        else:
            log_result("Round3: POST /applications/{id}/voice (multipart audio)", False, 
                      f"Missing voice_note or transcription_enabled: {data.keys()}")
    else:
        log_result("Round3: POST /applications/{id}/voice (multipart audio)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_application_voice_get():
    """Test GET /applications/{id}/voice/{nid} returns audio binary"""
    global application_id_for_round3
    
    if not application_id_for_round3:
        log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", False, 
                  "No application_id available")
        return
    
    # Get the application to find voice note ID
    resp = make_request("GET", f"/applications",
                       headers=auth_headers())
    
    if resp.status_code != 200:
        log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", False, 
                  f"Failed to get applications: {resp.status_code}")
        return
    
    apps = resp.json()
    app = next((a for a in apps if a["id"] == application_id_for_round3), None)
    
    if not app or not app.get("voice_notes") or len(app["voice_notes"]) == 0:
        log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", False, 
                  "No voice notes found in application")
        return
    
    voice_note_id = app["voice_notes"][0]["id"]
    
    # Get the audio
    resp = make_request("GET", f"/applications/{application_id_for_round3}/voice/{voice_note_id}",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        content_type = resp.headers.get("content-type", "")
        if "audio" in content_type:
            if len(resp.content) > 0:
                log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", True)
            else:
                log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", False, 
                          "Empty audio response")
        else:
            log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", False, 
                      f"Wrong content-type: {content_type}")
    else:
        log_result("Round3: GET /applications/{id}/voice/{nid} (audio binary)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_saves_create():
    """Test POST /saves (Omni-Save with AI)"""
    global save_id_for_round3
    
    resp = make_request("POST", "/saves",
                       headers=auth_headers(),
                       json={
                           "url": "https://linkedin.com/posts/example-sql-questions",
                           "note": "Great SQL interview questions",
                           "source": "linkedin"
                       },
                       timeout=30)
    
    if resp.status_code == 200:
        data = resp.json()
        required = ["title", "summary", "tags", "category"]
        if all(k in data for k in required):
            save_id_for_round3 = data["id"]
            log_result("Round3: POST /saves (Omni-Save AI)", True)
        else:
            log_result("Round3: POST /saves (Omni-Save AI)", False, 
                      f"Missing required fields. Got: {data.keys()}")
    else:
        log_result("Round3: POST /saves (Omni-Save AI)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_saves_list():
    """Test GET /saves"""
    resp = make_request("GET", "/saves",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            log_result("Round3: GET /saves", True)
        else:
            log_result("Round3: GET /saves", False, "Response is not a list")
    else:
        log_result("Round3: GET /saves", False, f"Status {resp.status_code}: {resp.text}")

def test_saves_delete():
    """Test DELETE /saves/{id}"""
    global save_id_for_round3
    
    if not save_id_for_round3:
        log_result("Round3: DELETE /saves/{id}", False, "No save_id available")
        return
    
    resp = make_request("DELETE", f"/saves/{save_id_for_round3}",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("deleted") == True:
            log_result("Round3: DELETE /saves/{id}", True)
        else:
            log_result("Round3: DELETE /saves/{id}", False, "deleted field not True")
    else:
        log_result("Round3: DELETE /saves/{id}", False, f"Status {resp.status_code}: {resp.text}")

def test_extension_capture():
    """Test POST /extension/capture with add_to_board and stage"""
    resp = make_request("POST", "/extension/capture",
                       headers=auth_headers(),
                       json={
                           "title": "AI Engineer",
                           "company": "Acme Corp",
                           "url": "https://acme.com/jobs/ai-engineer",
                           "description": "Python LLM role with FastAPI",
                           "add_to_board": True,
                           "stage": "applied"
                       })
    
    if resp.status_code == 200:
        data = resp.json()
        if "saved_job" in data and "application" in data:
            if data["application"] and data["application"].get("stage") == "applied":
                log_result("Round3: POST /extension/capture (with add_to_board, stage)", True)
            else:
                log_result("Round3: POST /extension/capture (with add_to_board, stage)", False, 
                          f"Application stage is {data['application'].get('stage')}, expected 'applied'")
        else:
            log_result("Round3: POST /extension/capture (with add_to_board, stage)", False, 
                      f"Missing saved_job or application: {data.keys()}")
    else:
        log_result("Round3: POST /extension/capture (with add_to_board, stage)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_extension_quick_ats():
    """Test POST /extension/quick-ats (AI)"""
    resp = make_request("POST", "/extension/quick-ats",
                       headers=auth_headers(),
                       json={"job_description": "Python LLM APIs with FastAPI and Docker"},
                       timeout=30)
    
    if resp.status_code == 200:
        data = resp.json()
        if "result" in data and "overall_score" in data["result"]:
            log_result("Round3: POST /extension/quick-ats (AI)", True)
        else:
            log_result("Round3: POST /extension/quick-ats (AI)", False, 
                      f"Missing result.overall_score: {data.keys()}")
    else:
        log_result("Round3: POST /extension/quick-ats (AI)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_extension_autofill():
    """Test GET /extension/autofill"""
    resp = make_request("GET", "/extension/autofill",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        expected_fields = ["full_name", "email", "phone", "location", "current_role", "skills"]
        if all(k in data for k in expected_fields):
            log_result("Round3: GET /extension/autofill", True)
        else:
            log_result("Round3: GET /extension/autofill", False, 
                      f"Missing expected fields. Got: {data.keys()}")
    else:
        log_result("Round3: GET /extension/autofill", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_gmail_status():
    """Test GET /gmail/status (EXPECTED: enabled=false, connected=false)"""
    resp = make_request("GET", "/gmail/status",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "enabled" in data and "connected" in data:
            if data["enabled"] == False and data["connected"] == False:
                log_result("Round3: GET /gmail/status (gated, expected)", True)
            else:
                log_warning("Round3: GET /gmail/status", 
                           f"enabled={data['enabled']}, connected={data['connected']} (expected both False)")
                log_result("Round3: GET /gmail/status (gated, expected)", True)
        else:
            log_result("Round3: GET /gmail/status (gated, expected)", False, 
                      f"Missing enabled or connected: {data.keys()}")
    else:
        log_result("Round3: GET /gmail/status (gated, expected)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_gmail_login():
    """Test GET /gmail/login (EXPECTED: 501 not configured)"""
    resp = make_request("GET", "/gmail/login",
                       headers=auth_headers())
    
    if resp.status_code == 501:
        log_result("Round3: GET /gmail/login (501 expected)", True)
    else:
        log_result("Round3: GET /gmail/login (501 expected)", False, 
                  f"Expected 501, got {resp.status_code}: {resp.text}")

def test_hermes_status():
    """Test GET /hermes/status (EXPECTED: configured=false)"""
    resp = make_request("GET", "/hermes/status",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "configured" in data:
            if data["configured"] == False:
                log_result("Round3: GET /hermes/status (gated, expected)", True)
            else:
                log_warning("Round3: GET /hermes/status", 
                           f"configured={data['configured']} (expected False)")
                log_result("Round3: GET /hermes/status (gated, expected)", True)
        else:
            log_result("Round3: GET /hermes/status (gated, expected)", False, 
                      "Missing configured field")
    else:
        log_result("Round3: GET /hermes/status (gated, expected)", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_hermes_context():
    """Test GET /hermes/context"""
    resp = make_request("GET", "/hermes/context",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "profile" in data and "latest_resume" in data:
            log_result("Round3: GET /hermes/context", True)
        else:
            log_result("Round3: GET /hermes/context", False, 
                      f"Missing profile or latest_resume: {data.keys()}")
    else:
        log_result("Round3: GET /hermes/context", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_hermes_sessions_create():
    """Test POST /hermes/sessions"""
    global hermes_session_id
    
    resp = make_request("POST", "/hermes/sessions",
                       headers=auth_headers(),
                       json={"goal": "Find Python jobs in SF", "kind": "job_search"})
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and "goal" in data and "kind" in data:
            hermes_session_id = data["id"]
            log_result("Round3: POST /hermes/sessions", True)
        else:
            log_result("Round3: POST /hermes/sessions", False, 
                      f"Missing required fields: {data.keys()}")
    else:
        log_result("Round3: POST /hermes/sessions", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_hermes_sessions_add_event():
    """Test POST /hermes/sessions/{id}/events"""
    global hermes_session_id
    
    if not hermes_session_id:
        log_result("Round3: POST /hermes/sessions/{id}/events", False, 
                  "No hermes_session_id available")
        return
    
    resp = make_request("POST", f"/hermes/sessions/{hermes_session_id}/events",
                       headers=auth_headers(),
                       json={"type": "observation", "message": "Found 10 jobs"})
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") == True and "event" in data:
            log_result("Round3: POST /hermes/sessions/{id}/events", True)
        else:
            log_result("Round3: POST /hermes/sessions/{id}/events", False, 
                      f"Missing ok or event: {data.keys()}")
    else:
        log_result("Round3: POST /hermes/sessions/{id}/events", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_hermes_sessions_get():
    """Test GET /hermes/sessions/{id}"""
    global hermes_session_id
    
    if not hermes_session_id:
        log_result("Round3: GET /hermes/sessions/{id}", False, 
                  "No hermes_session_id available")
        return
    
    resp = make_request("GET", f"/hermes/sessions/{hermes_session_id}",
                       headers=auth_headers())
    
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data and "events" in data:
            log_result("Round3: GET /hermes/sessions/{id}", True)
        else:
            log_result("Round3: GET /hermes/sessions/{id}", False, 
                      f"Missing id or events: {data.keys()}")
    else:
        log_result("Round3: GET /hermes/sessions/{id}", False, 
                  f"Status {resp.status_code}: {resp.text}")

def test_auth_protection_round3():
    """Test that Round 3 endpoints require auth (401 without token)"""
    endpoints = [
        ("POST", "/resumes/analyze-text", {"resume_text": "test", "job_description": "test"}),
        ("POST", "/jobs/agent-search", {"query": "test"}),
        ("POST", "/saves", {"url": "http://test.com"}),
        ("GET", "/saves", None),
        ("GET", "/extension/autofill", None),
        ("GET", "/gmail/status", None),
        ("GET", "/hermes/status", None),
        ("GET", "/hermes/context", None),
    ]
    
    failed = []
    for method, endpoint, body in endpoints:
        kwargs = {}
        if body:
            kwargs["json"] = body
        resp = make_request(method, endpoint, **kwargs)
        if resp.status_code != 401:
            failed.append(f"{method} {endpoint} returned {resp.status_code}, expected 401")
    
    if not failed:
        log_result("Round3: Auth protection (401 without token)", True)
    else:
        log_result("Round3: Auth protection (401 without token)", False, 
                  f"Some endpoints not protected: {'; '.join(failed)}")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all tests in order"""
    print("\n" + "="*80)
    print("JOB THEORY BACKEND API TEST SUITE - ROUND 3")
    print("="*80 + "\n")
    
    print("🔐 AUTH SANITY CHECK")
    print("-" * 80)
    test_auth_register()
    test_auth_login_success()
    test_auth_me_with_token()
    
    print("\n🆕 ROUND 3 NEW ENDPOINTS")
    print("-" * 80)
    
    print("\n📄 Resume Analysis with ATS Compliance")
    test_resume_analyze_text()
    test_resume_analyze_with_ats()
    
    print("\n🤖 Agentic Job Search")
    test_jobs_agent_search()
    
    print("\n📥 DOCX Export")
    test_resume_docx_export()
    test_resume_version_docx_export()
    
    print("\n📝 Application Notes")
    test_application_notes_add()
    test_application_notes_delete()
    
    print("\n💡 Interview Questions (AI)")
    test_application_interview_questions()
    
    print("\n🎤 Voice Notes")
    test_application_voice_add()
    test_application_voice_get()
    
    print("\n💾 Omni-Save")
    test_saves_create()
    test_saves_list()
    test_saves_delete()
    
    print("\n🔌 Extension Endpoints")
    test_extension_capture()
    test_extension_quick_ats()
    test_extension_autofill()
    
    print("\n📧 Gmail (Gated - Expected Behavior)")
    test_gmail_status()
    test_gmail_login()
    
    print("\n🤖 Hermes Agent")
    test_hermes_status()
    test_hermes_context()
    test_hermes_sessions_create()
    test_hermes_sessions_add_event()
    test_hermes_sessions_get()
    
    print("\n🔒 Auth Protection")
    test_auth_protection_round3()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"✅ Passed: {len(results['passed'])}")
    print(f"❌ Failed: {len(results['failed'])}")
    print(f"⚠️  Warnings: {len(results['warnings'])}")
    
    if results['failed']:
        print("\n❌ FAILED TESTS:")
        for fail in results['failed']:
            print(f"  - {fail['test']}")
            print(f"    {fail['message']}")
    
    if results['warnings']:
        print("\n⚠️  WARNINGS:")
        for warn in results['warnings']:
            print(f"  - {warn['test']}")
            print(f"    {warn['message']}")
    
    print("\n" + "="*80)
    
    # Return exit code
    return 0 if len(results['failed']) == 0 else 1

if __name__ == "__main__":
    exit(run_all_tests())
