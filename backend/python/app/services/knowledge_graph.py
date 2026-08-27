"""
Resume Knowledge Graph — extract structured entities, achievements, timeline from resume text.
Powers cover letters, interview prep, negotiation scripts, and skills gap analysis.
"""
import json
import re
from typing import Dict, Any, List, Optional
from app.services.llm_service import LLMNotConfiguredError
from app.schemas import Achievement, SkillEntity, TimelineEvent

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

        # Convert skill names to SkillEntity objects
        skill_entities: List[SkillEntity] = []
        for s in skills:
            # Determine type based on skill name heuristics
            skill_type = "tool"
            if s in {"python", "javascript", "typescript", "java", "go", "rust", "c++", "c#", "ruby", "php", "swift", "kotlin", "scala", "perl", "r", "matlab", "sql", "bash", "powershell"}:
                skill_type = "programming_language"
            elif s in {"react", "vue", "angular", "svelte", "next.js", "nuxt", "gatsby", "node.js", "express", "django", "flask", "fastapi", "spring", "rails", "laravel"}:
                skill_type = "framework"
            elif s in {"kubernetes", "docker", "terraform", "ansible", "puppet", "chef", "jenkins", "github actions", "gitlab ci", "circleci", "travisci", "teamcity", "bamboo", "postgresql", "mysql", "mariadb", "mongodb", "dynamodb", "cassandra", "couchbase", "redis", "memcached", "elasticsearch", "solr", "kafka", "rabbitmq", "activemq", "sqs", "sns", "graphql", "rest api", "grpc", "soap", "websocket", "microservices", "soa", "serverless", "lambda", "functions", "faas", "edge computing"}:
                skill_type = "tool"
            skill_entities.append(SkillEntity(
                name=s,
                type=skill_type,
                confidence=1.0 if s in KnowledgeGraphExtractor.COMMON_SKILLS else 0.7,
            ))

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
                # Map to Achievement schema: description = synthesized text, quantified = whether metric present
                desc = line[:200]
                achievement = Achievement(
                    description=desc,
                    quantified=bool(metric),
                    impact_metric=metric if metric else None,
                    category=technology if technology else None,
                )
                achievements.append(achievement)
            if len(achievements) >= 10:
                break

# Timeline extraction (dates)
        date_pattern = re.compile(r'(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{4}\b)\s*[-–—]\s*(\b(?:Present|Current|Now|Jan|Feb|Mar|Apr|May|June|July|August|September|October|November|December)?\s*\d{4}\b)', re.IGNORECASE)
        timeline = []
        for match in date_pattern.finditer(resume_text):
            start = match.group(1)
            end = match.group(2)
            timeline.append(TimelineEvent(
                company="",
                title="",
                start_date=start,
                end_date=end,
                description=None,
            ))

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

        # Use LLM for advanced extraction (Phase 3.3: Instructor-backed typed output).
        # ponytail: chunked via long_context (spec 2026-08-02) — the resume is
        # extracted per section in parallel instead of head-slicing at [:2500];
        # per-chunk dicts are unioned here (FactUnionMerger).
        extract_template = """Extract structured information from this resume. Return ONLY a JSON object with these keys:
{
  "skills": [list of technical skills],
  "companies": [list of companies worked at],
  "job_titles": [list of job titles],
  "technologies": [list of technologies/frameworks/tools],
  "certifications": [list of certifications],
  "education": [{"degree": "...", "field": "...", "institution": "..."}],
  "achievements": [{"metric": "...", "action": "...", "context": "..."}],
  "timeline": [{"company": "...", "title": "...", "duration_months": 0}]
}

Resume:
{LONG_TEXT}"""

        llm_data: Dict[str, Any] = {}
        try:
            from app.llm.long_context import LongContextClient  # lazy: no import cycle
            results = await LongContextClient().map_only(
                resume_text,
                extract_template,
                kind="resume",
                max_tokens=600,
                temperature=0.3,
            )
            for r in results:
                if not r.ok:
                    continue
                try:
                    # Try to parse chunk JSON with regex fallback
                    json_match = re.search(r'\{.*\}', r.text, re.DOTALL)
                    if not json_match:
                        continue
                    raw = json.loads(json_match.group(0))
                    # Validate against typed schema if available
                    if KnowledgeGraphLLMOutput is not None:
                        validated = KnowledgeGraphLLMOutput(**raw)
                        # exclude_defaults so an empty/near-empty LLM response
                        # (every field left at its [] default) dumps to {} —
                        # otherwise `bool(llm_data)` below would be True purely
                        # because model_dump() always emits every field key,
                        # falsely marking llm_enhanced=True for a no-op response.
                        chunk_data = validated.model_dump(exclude_defaults=True)
                    else:
                        chunk_data = raw
                except (json.JSONDecodeError, Exception):  # noqa: BLE001 - bad chunk
                    continue
                # FactUnionMerger: extend list fields in chunk order
                for key, value in chunk_data.items():
                    if isinstance(value, list):
                        llm_data.setdefault(key, []).extend(value)
                    elif key not in llm_data:
                        llm_data[key] = value
        except LLMNotConfiguredError:
            # No LLM configured — regex-only extraction is fine
            pass
        except Exception:
            pass

        # Merge LLM-extracted skills/companies/job_titles into the regex
        # results — the prompt asks for all three but they were previously
        # discarded here (only technologies/certifications/education/timeline
        # were merged), silently dropping real LLM extraction data.
        skills = list(dict.fromkeys(skills + [str(x).lower() for x in llm_data.get("skills", []) if x]))[:20]
        companies = list(dict.fromkeys(companies + [str(x) for x in llm_data.get("companies", []) if x]))[:10]
        titles = list(dict.fromkeys(titles + [str(x) for x in llm_data.get("job_titles", []) if x]))[:8]

        # LLM achievements come back as {"metric","action","context"} (per the
        # prompt schema above) with no "text" key, but schemas.Achievement
        # requires text — synthesize it so the merged list still validates.
        # The metric is NOT dropped: it maps onto Achievement.impact_metric,
        # the one schema field the regex-extracted achievements never
        # populate, so LLM-extracted quantified impact survives to the API.
        llm_achievements = []
        for a in llm_data.get("achievements", []):
            if not isinstance(a, dict):
                continue
            text = a.get("text") or " ".join(str(v) for v in (a.get("action"), a.get("context")) if v).strip()
            if not text:
                continue
            normalized = {**a, "text": text}
            if a.get("metric") and not normalized.get("impact_metric"):
                normalized["impact_metric"] = str(a["metric"])
            if a.get("category") and not normalized.get("category"):
                normalized["category"] = str(a["category"])
            llm_achievements.append(normalized)
        achievements = achievements + llm_achievements

        result = {
            "skills": [{"name": s} for s in skills],
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
            "graph_json": KnowledgeGraphExtractor.build_networkx_graph_dict(skills, companies, titles, llm_data.get("technologies", [])),
        }
        # Validate against the typed schema so a shape regression here fails
        # loudly at the source instead of surfacing as a confusing downstream
        # FastAPI serialization error.
        from app.schemas import KnowledgeGraphResponse
        KnowledgeGraphResponse(**result)
        return result

    @staticmethod
    def build_networkx_graph_dict(skills: List[str], companies: List[str], titles: List[str], technologies: List[str]) -> Dict[str, Any]:
        """Build NetworkX DiGraph representation of Candidate Knowledge Graph."""
        import networkx as nx
        G = nx.DiGraph()

        # Add Root Candidate Node
        G.add_node("Candidate", type="person", label="Candidate Profile")

        # Add Skill Nodes & Edges
        for s in skills:
            node_id = f"skill:{s}"
            G.add_node(node_id, type="skill", name=s)
            G.add_edge("Candidate", node_id, relationship="HAS_SKILL")

        # Add Company Nodes & Edges
        for c in companies:
            node_id = f"company:{c}"
            G.add_node(node_id, type="company", name=c)
            G.add_edge("Candidate", node_id, relationship="WORKED_AT")

        # Add Job Title Nodes & Edges
        for t in titles:
            node_id = f"role:{t}"
            G.add_node(node_id, type="role", name=t)
            G.add_edge("Candidate", node_id, relationship="HELD_TITLE")

        # Add Technology Nodes & Edges
        for t in technologies:
            node_id = f"technology:{t}"
            G.add_node(node_id, type="technology", name=t)
            G.add_edge("Candidate", node_id, relationship="KNOWS_TECHNOLOGY")

        # Return serialized node-link data structure
        return nx.node_link_data(G, edges="links")

