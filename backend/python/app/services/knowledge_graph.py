"""
Resume Knowledge Graph — extract structured entities, achievements, timeline from resume text.
Powers cover letters, interview prep, negotiation scripts, and skills gap analysis.
"""
import json
import re
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_complete, LLMNotConfiguredError

# ---------------------------------------------------------------------------
# Instructor-backed typed extraction (Phase 3.3)
# If instructor + an OpenAI-compatible provider are available, we use them to
# get validated structured output. Falls back to regex JSON parse otherwise.
# ---------------------------------------------------------------------------
try:
    import instructor  # noqa: F401
    _INSTRUCTOR_AVAILABLE = True
except ImportError:
    _INSTRUCTOR_AVAILABLE = False

try:
    from pydantic import BaseModel as _BaseModel

    class KnowledgeGraphLLMOutput(_BaseModel):
        """Typed schema for LLM-extracted resume data (Phase 3.3)."""
        skills: List[str] = []
        companies: List[str] = []
        job_titles: List[str] = []
        technologies: List[str] = []
        certifications: List[str] = []
        education: List[Dict[str, str]] = []
        achievements: List[Dict[str, str]] = []
        timeline: List[Dict[str, Any]] = []

except ImportError:
    KnowledgeGraphLLMOutput = None  # type: ignore



class KnowledgeGraphExtractor:
    COMMON_SKILLS = {
        "python", "javascript", "typescript", "java", "go", "rust", "c++", "c#", "ruby", "php", "swift", "kotlin",
        "scala", "perl", "r", "matlab", "sql", "bash", "powershell",
        "react", "vue", "angular", "svelte", "next.js", "nuxt", "gatsby",
        "node.js", "express", "django", "flask", "fastapi", "spring", "rails", "laravel",
        "kubernetes", "docker", "terraform", "ansible", "puppet", "chef",
        "aws", "amazon web services", "gcp", "google cloud", "azure", "ibm cloud", "oracle cloud",
        "linux", "ubuntu", "centos", "redhat", "debian", "windows server",
        "nginx", "apache", "haproxy", "varnish",
        "jenkins", "github actions", "gitlab ci", "circleci", "travisci", "teamcity", "bamboo",
        "postgresql", "mysql", "mariadb", "mongodb", "dynamodb", "cassandra", "couchbase",
        "redis", "memcached", "elasticsearch", "solr", "kafka", "rabbitmq", "activemq", "sqs", "sns",
        "graphql", "rest api", "grpc", "soap", "websocket", "microservices", "soa",
        "serverless", "lambda", "functions", "faas", "edge computing",
        "machine learning", "deep learning", "tensorflow", "pytorch", "keras", "scikit-learn",
        "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly", "jupyter",
        "data science", "data engineering", "analytics", "bi", "tableau", "powerbi", "looker",
        "ci/cd", "devops", "sre", "platform engineering", "infrastructure", "cloud engineering",
        "product management", "project management", "agile", "scrum", "kanban", "jira", "confluence",
        "ux design", "ui design", "figma", "sketch", "adobe xd", "prototyping",
        "seo", "sem", "google analytics", "content marketing", "social media", "growth hacking",
        "salesforce", "hubspot", "marketo", "crm", "erp", "sap",
        "blockchain", "ethereum", "solidity", "web3", "smart contracts",
        "cybersecurity", "penetration testing", "incident response", "compliance", "gdpr", "soc2",
    }

    @staticmethod
    async def extract(resume_text: str) -> Dict[str, Any]:
        text_lower = resume_text.lower()

        # Skills extraction
        skills = [s for s in KnowledgeGraphExtractor.COMMON_SKILLS if s in text_lower]
        # Also extract capitalized tech terms (heuristic)
        tech_pattern = re.compile(r'\b([A-Z][a-zA-Z]*\.?(?:js|py|go|io|db|sql|ai|ml|ci|cd|api|ui|ux|os|aws|gcp|aws|saas|paas|iaas|devops|))\b')
        extra_tech = [t for t in set(tech_pattern.findall(resume_text)) if len(t) > 1 and t.lower() not in skills]
        skills = list(dict.fromkeys(skills + [t.lower() for t in extra_tech]))[:20]

        # Company extraction (title-case words near "at" or "worked at")
        company_pattern = re.compile(r'(?:at|worked at|with|for)\s+([A-Z][A-Za-z0-9&\s]+?)(?:,|\.|\(|\n|$)', re.IGNORECASE)
        companies = [m.strip() for m in company_pattern.findall(resume_text) if len(m.strip()) > 2][:10]

        # Job titles
        title_keywords = ["engineer", "manager", "director", "architect", "developer", "analyst", "scientist", "designer", "consultant", "lead", "principal", "staff", "senior", "junior", "intern", "coordinator", "specialist", "administrator", "representative"]
        title_pattern = re.compile(r'\b(?:Senior|Staff|Principal|Lead|Junior|Associate|)?\s*(?:Software|Data|DevOps|Product|Project|UX|UI|Cloud|Security|ML|AI|Frontend|Backend|Full[ -]Stack|Site Reliability|Platform|Infrastructure|Mobile|Web|Systems|Network|Database|Business|Marketing|Sales|Customer|Technical|QA|Quality|Automation|Build|Release)?\s*(?:Engineer|Developer|Manager|Director|Architect|Analyst|Scientist|Designer|Consultant|Lead|Specialist|Coordinator|Administrator|Representative)\b', re.IGNORECASE)
        titles = list(dict.fromkeys([t.strip() for t in title_pattern.findall(resume_text) if len(t.strip()) > 5]))[:8]

        # Achievements (sentences with metrics)
        achievements = []
        metric_pattern = re.compile(r'\b(reduced|increased|improved|led|launched|built|shipped|grew|saved|cut|boosted|optimized|designed|implemented|delivered|achieved|spearheaded|created|developed|managed|engineered|architected|refactored|automated|scaled|migrated|decreased|enhanced|accelerated|streamlined|drove|generated|produced|won|secured|negotiated|closed).+?\d+%?|\$?\d+[KkMmBb]?\b', re.IGNORECASE)
        for line in resume_text.split("\n"):
            line = line.strip()
            if len(line) > 20 and metric_pattern.search(line):
                # Extract metric, action, technology
                metric_match = re.search(r'\d+%?|\$?\d+[KkMmBb]?\b', line)
                metric = metric_match.group(0) if metric_match else ""
                action_match = re.search(r'\b(reduced|increased|improved|led|launched|built|shipped|grew|saved|cut|boosted|optimized|designed|implemented|delivered|achieved|spearheaded|created|developed|managed|engineered|architected|refactored|automated|scaled|migrated|decreased|enhanced|accelerated|streamlined|drove|generated|produced|won|secured|negotiated|closed)\b', line, re.IGNORECASE)
                action = action_match.group(0) if action_match else ""
                tech_match = re.search(r'\b(?:using|with|via)\s+([A-Za-z0-9\s]+?)(?:,|\.|\band\b|$)', line, re.IGNORECASE)
                technology = tech_match.group(1).strip() if tech_match else ""
                achievements.append({
                    "text": line[:200],
                    "metric": metric,
                    "action": action,
                    "technology": technology,
                })
            if len(achievements) >= 10:
                break

        # Timeline extraction (dates)
        date_pattern = re.compile(r'(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{4}\b)\s*[-–—]\s*(\b(?:Present|Current|Now|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{4}\b)', re.IGNORECASE)
        timeline = []
        for match in date_pattern.finditer(resume_text):
            start = match.group(1)
            end = match.group(2)
            timeline.append({"start": start, "end": end})

        # Education
        edu_pattern = re.compile(r'\b(BS|BA|MS|MA|MBA|PhD|MD|JD|B\.S\.|B\.A\.|M\.S\.|M\.A\.|M\.B\.A\.|Ph\.D\.)\b.*?(?:in|of)\s+([A-Za-z\s]+?)(?:,|\.|\n|$)', re.IGNORECASE)
        education = []
        for match in edu_pattern.finditer(resume_text):
            education.append({
                "degree": match.group(1),
                "field": match.group(2).strip(),
            })

        # Certifications
        cert_pattern = re.compile(r'\b(AWS Certified|Google Certified|Azure Certified|CCNA|CCNP|CISSP|PMP|CSM|Scrum Master|ITIL|TOGAF|CFA|CPA|Six Sigma|Lean|Kubernetes Certified|Docker Certified|HashiCorp Certified|Salesforce Certified|Tableau Certified|Power BI Certified)\b', re.IGNORECASE)
        certifications = [m.strip() for m in cert_pattern.findall(resume_text)]

        # Use LLM for advanced extraction (Phase 3.3: Instructor-backed typed output)
        prompt = f"""Extract structured information from this resume. Return ONLY a JSON object with these keys:
{{
  "skills": [list of technical skills],
  "companies": [list of companies worked at],
  "job_titles": [list of job titles],
  "technologies": [list of technologies/frameworks/tools],
  "certifications": [list of certifications],
  "education": [{{"degree": "...", "field": "...", "institution": "..."}}],
  "achievements": [{{"metric": "...", "action": "...", "context": "..."}}],
  "timeline": [{{"company": "...", "title": "...", "duration_months": 0}}]
}}

Resume:
{resume_text[:2500]}"""

        llm_data: Dict[str, Any] = {}
        try:
            llm_result = await llm_complete("", prompt, max_tokens=600, temperature=0.3)
            # Try to parse LLM JSON with regex fallback
            json_match = re.search(r'\{.*\}', llm_result, re.DOTALL)
            if json_match:
                raw = json.loads(json_match.group(0))
                # Validate against typed schema if available
                if KnowledgeGraphLLMOutput is not None:
                    validated = KnowledgeGraphLLMOutput(**raw)
                    llm_data = validated.model_dump()
                else:
                    llm_data = raw
        except LLMNotConfiguredError:
            # No LLM configured — regex-only extraction is fine
            pass
        except json.JSONDecodeError:
            pass
        except Exception:
            pass

        return {
            "entities": {
                "skills": skills,
                "companies": companies,
                "job_titles": titles,
                "technologies": llm_data.get("technologies", []),
                "certifications": certifications + llm_data.get("certifications", []),
                "education": education + llm_data.get("education", []),
            },
            "achievements": achievements,
            "timeline": timeline + llm_data.get("timeline", []),
            "llm_enhanced": bool(llm_data),
        }
