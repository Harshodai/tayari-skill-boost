"""Lightweight skill taxonomy (ESCO/O*NET-inspired, curated).
Maps surface forms to canonical skills and models skill adjacency so matching
generalizes beyond exact keywords ('pandas' relates to 'data analysis', 'react'
implies 'frontend'). Used by the hybrid job-matching pipeline.
"""
from __future__ import annotations

import re
from typing import Union

# canonical -> (synonyms/surface forms, adjacent canonical skills)
TAXONOMY: dict = {
    "python": (["python3", "py"], ["backend", "data analysis", "scripting"]),
    "java": ([], ["backend", "spring"]),
    "javascript": (["js", "ecmascript"], ["frontend", "nodejs", "typescript"]),
    "typescript": (["ts"], ["javascript", "frontend"]),
    "go": (["golang"], ["backend", "microservices"]),
    "rust": ([], ["systems programming", "backend"]),
    "c++": (["cpp"], ["systems programming"]),
    "c#": (["csharp", ".net", "dotnet"], ["backend"]),
    "php": (["laravel", "symfony"], ["backend", "web development"]),
    "ruby": (["rails", "ruby on rails"], ["backend", "web development"]),
    "sql": (["tsql", "plsql"], ["databases", "data analysis"]),
    "react": (["reactjs", "react.js"], ["frontend", "javascript", "nextjs"]),
    "nextjs": (["next.js", "next"], ["react", "frontend"]),
    "vue": (["vuejs", "vue.js", "nuxt"], ["frontend", "javascript"]),
    "angular": (["angularjs"], ["frontend", "typescript"]),
    "nodejs": (["node", "node.js", "express", "expressjs"], ["backend", "javascript"]),
    "django": ([], ["python", "backend", "web development"]),
    "fastapi": ([], ["python", "backend", "rest api"]),
    "flask": ([], ["python", "backend"]),
    "spring": (["spring boot", "springboot"], ["java", "backend"]),
    "frontend": (["front-end", "front end", "ui development"], ["web development"]),
    "backend": (["back-end", "back end", "server-side"], ["web development", "rest api"]),
    "fullstack": (["full-stack", "full stack"], ["frontend", "backend"]),
    "rest api": (["restful", "rest", "apis", "api development"], ["backend", "microservices"]),
    "graphql": ([], ["rest api", "backend"]),
    "grpc": ([], ["microservices", "backend"]),
    "microservices": (["micro-services", "service oriented"], ["distributed systems", "backend"]),
    "distributed systems": ([], ["microservices", "scalability"]),
    "scalability": (["high availability", "high-load"], ["distributed systems"]),
    "aws": (["amazon web services", "ec2", "s3", "lambda", "dynamodb"], ["cloud", "devops"]),
    "gcp": (["google cloud", "bigquery"], ["cloud", "devops"]),
    "azure": (["microsoft azure"], ["cloud", "devops"]),
    "cloud": (["cloud computing", "cloud native"], ["devops"]),
    "docker": (["containers", "containerization"], ["kubernetes", "devops"]),
    "kubernetes": (["k8s", "helm"], ["docker", "devops", "cloud"]),
    "terraform": (["iac", "infrastructure as code"], ["devops", "cloud"]),
    "ci/cd": (["cicd", "continuous integration", "continuous delivery", "jenkins",
               "github actions", "gitlab ci"], ["devops"]),
    "devops": (["sre", "site reliability"], ["ci/cd", "cloud", "monitoring"]),
    "monitoring": (["observability", "prometheus", "grafana", "datadog"], ["devops"]),
    "linux": (["unix", "bash", "shell"], ["devops", "scripting"]),
    "postgresql": (["postgres", "psql"], ["databases", "sql"]),
    "mysql": (["mariadb"], ["databases", "sql"]),
    "mongodb": (["mongo", "nosql"], ["databases"]),
    "redis": (["memcached", "caching"], ["databases", "performance"]),
    "elasticsearch": (["opensearch", "elk"], ["databases", "search"]),
    "kafka": (["event streaming", "rabbitmq", "message queue", "pubsub"],
              ["distributed systems", "microservices"]),
    "databases": (["database design", "db"], ["sql"]),
    "machine learning": (["ml", "scikit-learn", "sklearn", "xgboost"],
                         ["data science", "ai", "deep learning"]),
    "deep learning": (["neural networks", "pytorch", "tensorflow", "keras"],
                      ["machine learning", "ai"]),
    "ai": (["artificial intelligence", "genai", "generative ai"],
           ["machine learning", "llm"]),
    "llm": (["large language models", "prompt engineering", "rag", "langchain",
             "openai", "fine-tuning"], ["ai", "nlp"]),
    "nlp": (["natural language processing", "text mining"], ["machine learning", "ai"]),
    "computer vision": (["cv", "opencv", "image processing"], ["deep learning"]),
    "data science": (["data scientist"], ["machine learning", "data analysis", "statistics"]),
    "data analysis": (["data analytics", "analytics", "pandas", "numpy"],
                      ["data science", "sql", "visualization"]),
    "data engineering": (["etl", "data pipelines", "airflow", "spark", "dbt", "snowflake",
                          "databricks"], ["databases", "big data"]),
    "big data": (["hadoop", "hive"], ["data engineering"]),
    "statistics": (["statistical analysis", "a/b testing", "ab testing"], ["data science"]),
    "visualization": (["tableau", "power bi", "powerbi", "looker", "dashboards"],
                      ["data analysis"]),
    "mobile": (["ios", "android", "swift", "kotlin", "react native", "flutter"],
               ["frontend"]),
    "security": (["cybersecurity", "appsec", "infosec", "penetration testing", "owasp"],
                 ["devops"]),
    "testing": (["qa", "quality assurance", "unit testing", "selenium", "cypress",
                 "playwright", "pytest", "tdd"], ["automation"]),
    "automation": (["rpa", "scripting"], ["testing", "devops"]),
    "scripting": ([], ["automation", "linux"]),
    "git": (["github", "gitlab", "version control"], []),
    "agile": (["scrum", "kanban", "sprint"], ["project management"]),
    "project management": (["jira", "program management", "pmp"], ["agile", "leadership"]),
    "product management": (["product owner", "roadmap", "product strategy"],
                           ["agile", "stakeholder management"]),
    "leadership": (["team lead", "mentoring", "people management", "engineering manager"],
                   ["project management", "communication"]),
    "communication": (["presentation", "stakeholder communication"],
                      ["stakeholder management"]),
    "stakeholder management": (["cross-functional", "collaboration"], ["communication"]),
    "ux": (["user experience", "ux design", "user research", "wireframing"],
           ["design", "ui"]),
    "ui": (["user interface", "ui design", "figma", "sketch"], ["ux", "design"]),
    "design": (["graphic design", "adobe", "photoshop", "illustrator"], ["ui", "ux"]),
    "marketing": (["digital marketing", "seo", "sem", "content marketing",
                   "social media"], ["growth"]),
    "growth": (["growth hacking", "conversion optimization"], ["marketing", "analytics"]),
    "sales": (["business development", "account management", "crm", "salesforce"],
              ["negotiation"]),
    "negotiation": ([], ["sales", "communication"]),
    "finance": (["financial analysis", "accounting", "fp&a", "excel"], []),
    "customer support": (["customer success", "helpdesk", "zendesk"], ["communication"]),
    "hr": (["recruiting", "talent acquisition", "human resources"], []),
    "blockchain": (["web3", "solidity", "smart contracts", "crypto"], ["backend"]),
    "game development": (["unity", "unreal", "gamedev"], []),
    "embedded": (["firmware", "iot", "rtos"], ["systems programming"]),
    "systems programming": (["low-level", "performance optimization"], []),
    "performance": (["optimization", "profiling"], ["scalability"]),
    "web development": (["web apps", "websites"], ["frontend", "backend"]),
    "search": (["information retrieval", "ranking"], ["elasticsearch"]),
}

# Role-family aliases sit beside the skill graph: they widen search intent without
# pretending that adjacent titles are identical. The primary title is always kept
# first, and callers can display the family/alias rationale to the candidate.
ROLE_FAMILIES: dict[str, dict[str, list[str]]] = {
    "data engineering": {
        "aliases": [
            "data engineer",
            "software engineer data",
            "software engineer, data",
            "data platform engineer",
            "data infrastructure engineer",
            "data pipeline engineer",
            "analytics engineer",
            "etl developer",
            "big data engineer",
        ],
        "adjacent": ["backend engineer", "machine learning engineer", "data analyst"],
    },
    "software engineering": {
        "aliases": [
            "software engineer",
            "software developer",
            "backend engineer",
            "platform engineer",
            "full stack engineer",
            "full-stack engineer",
            "distributed systems engineer",
        ],
        "adjacent": ["data platform engineer", "site reliability engineer", "developer productivity engineer"],
    },
    "machine learning engineering": {
        "aliases": [
            "machine learning engineer",
            "ml engineer",
            "applied scientist",
            "ai engineer",
            "ml platform engineer",
            "machine learning platform engineer",
        ],
        "adjacent": ["data scientist", "data engineer", "software engineer"],
    },
}


def _normalize_role(value: str | None) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", str(value or "").lower()).strip()


def role_family(primary: str | None) -> str | None:
    """Return the canonical role family for a natural-language title."""
    normalized = _normalize_role(primary)
    if not normalized:
        return None
    for family, definition in ROLE_FAMILIES.items():
        aliases = [_normalize_role(alias) for alias in definition["aliases"]]
        if normalized in aliases or any(alias in normalized for alias in aliases):
            return family
    return None


def expand_role_queries(primary: str | None, limit: int = 6) -> list[str]:
    """Expand a title into close aliases while preserving the user's exact query."""
    original = str(primary or "").strip()
    if not original:
        return []
    family = role_family(original)
    if not family:
        return [original]
    definition = ROLE_FAMILIES[family]
    queries: list[str] = [original]
    for alias in definition["aliases"] + definition["adjacent"]:
        if _normalize_role(alias) != _normalize_role(original) and alias not in queries:
            queries.append(alias)
        if len(queries) >= limit:
            break
    return queries


_AMBIGUOUS_ROLE_TERMS = {
    "engineer", "developer", "analyst", "scientist", "architect", "manager", "designer",
}


def role_expansion_explanation(primary: str | None) -> dict:
    """Return transparent family, confidence, and clarification metadata.

    Exact known aliases receive high confidence; substring matches receive
    medium confidence. Unknown or generic role terms are never expanded and
    receive a clarification question only when the query is genuinely broad.
    """
    original = str(primary or "").strip()
    normalized = _normalize_role(original)
    family = role_family(original)
    if not original:
        return {
            "family": None,
            "expanded_queries": [],
            "adjacent_roles": [],
            "confidence": "unknown",
            "clarification_question": "What role family should I prioritize (for example, backend, data, platform, or ML)?",
        }

    if family:
        aliases = {_normalize_role(alias) for alias in ROLE_FAMILIES[family]["aliases"]}
        confidence = "high" if normalized in aliases else "medium"
        return {
            "family": family,
            "expanded_queries": expand_role_queries(original),
            "adjacent_roles": ROLE_FAMILIES[family]["adjacent"],
            "confidence": confidence,
            "clarification_question": None,
        }

    clarification = None
    if normalized in _AMBIGUOUS_ROLE_TERMS or len(normalized.split()) == 1 and normalized.endswith("er"):
        clarification = (
            f"Should I keep '{original}' broad, or focus it on a specialty such as backend, "
            "data/platform, ML, frontend, or another domain?"
        )
    return {
        "family": None,
        "expanded_queries": [original],
        "adjacent_roles": [],
        "confidence": "low" if clarification else "unknown",
        "clarification_question": clarification,
    }


# Build reverse lookup: surface form -> canonical
_SURFACE_TO_CANONICAL: dict = {}
for canonical, (synonyms, _adj) in TAXONOMY.items():
    _SURFACE_TO_CANONICAL[canonical] = canonical
    for s in synonyms:
        _SURFACE_TO_CANONICAL[s] = canonical

# Pre-compiled patterns for multi-word surface forms (longest first)
_SURFACES_SORTED = sorted(_SURFACE_TO_CANONICAL.keys(), key=len, reverse=True)
_PATTERN = re.compile(
    r"(?<![a-z0-9+#.])(" + "|".join(re.escape(s) for s in _SURFACES_SORTED) + r")(?![a-z0-9+#])",
    re.IGNORECASE)


def extract_skills(text: str) -> set:
    """Canonical skills detected in free text."""
    if not text:
        return set()
    return {_SURFACE_TO_CANONICAL[m.group(1).lower()]
            for m in _PATTERN.finditer(text.lower())
            if m.group(1).lower() in _SURFACE_TO_CANONICAL}


def expand_skills(skills: set) -> set:
    """Add first-degree adjacent skills (skill graph expansion)."""
    expanded = set(skills)
    for s in skills:
        if s in TAXONOMY:
            expanded.update(TAXONOMY[s][1])
    return expanded


# Directed Asymmetric Transfer Graph: (source_skill -> {target_skill: transfer_weight})
# Captures real-world domain mobility where learning B from A is easier than learning A from B.
ASYMMETRIC_TRANSFER: dict[str, dict[str, float]] = {
    "c++": {"go": 0.85, "rust": 0.80, "c#": 0.85, "systems programming": 0.95, "backend": 0.75},
    "rust": {"go": 0.85, "c++": 0.80, "systems programming": 0.95, "backend": 0.80},
    "go": {"c++": 0.45, "rust": 0.50, "backend": 0.90, "microservices": 0.90, "distributed systems": 0.75},
    "java": {"c#": 0.90, "go": 0.75, "kotlin": 0.90, "backend": 0.90, "spring": 0.85},
    "c#": {"java": 0.90, "go": 0.75, "backend": 0.90},
    "python": {"data analysis": 0.85, "data science": 0.80, "machine learning": 0.75, "backend": 0.85, "fastapi": 0.90, "django": 0.90, "scripting": 0.95},
    "javascript": {"typescript": 0.90, "nodejs": 0.85, "frontend": 0.90, "react": 0.80},
    "typescript": {"javascript": 0.95, "nodejs": 0.90, "frontend": 0.90, "react": 0.85, "angular": 0.85},
    "react": {"nextjs": 0.90, "vue": 0.80, "frontend": 0.95},
    "vue": {"react": 0.80, "frontend": 0.95},
    "angular": {"typescript": 0.90, "frontend": 0.95, "react": 0.75},
    "nodejs": {"backend": 0.85, "rest api": 0.85, "javascript": 0.95, "typescript": 0.85},
    "docker": {"kubernetes": 0.70, "devops": 0.80, "ci/cd": 0.75},
    "kubernetes": {"docker": 0.95, "devops": 0.90, "cloud": 0.85},
    "aws": {"gcp": 0.85, "azure": 0.85, "cloud": 0.95, "devops": 0.75},
    "gcp": {"aws": 0.85, "azure": 0.85, "cloud": 0.95},
    "azure": {"aws": 0.85, "gcp": 0.85, "cloud": 0.95},
    "postgresql": {"mysql": 0.90, "sql": 0.95, "databases": 0.90},
    "mysql": {"postgresql": 0.85, "sql": 0.95, "databases": 0.90},
    "machine learning": {"deep learning": 0.80, "data science": 0.85, "ai": 0.90, "nlp": 0.75, "computer vision": 0.75},
    "deep learning": {"machine learning": 0.90, "ai": 0.95, "llm": 0.85, "nlp": 0.85, "computer vision": 0.85},
    "ai": {"llm": 0.80, "machine learning": 0.90},
    "llm": {"nlp": 0.85, "ai": 0.90, "machine learning": 0.80},
    "data science": {"data analysis": 0.95, "machine learning": 0.80, "statistics": 0.90, "python": 0.85},
    "data engineering": {"data analysis": 0.75, "databases": 0.90, "big data": 0.85, "sql": 0.90},
    "testing": {"automation": 0.80, "ci/cd": 0.65},
    "automation": {"testing": 0.85, "scripting": 0.85, "devops": 0.70},
    "distributed systems": {"microservices": 0.95, "backend": 0.90, "scalability": 0.95},
    "microservices": {"distributed systems": 0.75, "backend": 0.90, "rest api": 0.90},
    "frontend": {"web development": 0.90, "ui": 0.85, "ux": 0.70, "fullstack": 0.75},
    "backend": {"web development": 0.85, "rest api": 0.90, "microservices": 0.85, "fullstack": 0.75},
    "web development": {"frontend": 0.85, "backend": 0.85},
    "devops": {"cloud": 0.90, "ci/cd": 0.90, "linux": 0.85, "monitoring": 0.85},
}


def compute_asymmetric_transfer(candidate_source: Union[str, set, list], job_target: Union[str, set, list]) -> dict:
    """Compute asymmetric, directed skill transfer from candidate to job requirements.

    Distinguishes direct overlap from directed mobility paths (e.g. C++ -> Go vs Go -> C++).
    """
    if isinstance(candidate_source, str):
        cand = extract_skills(candidate_source)
    else:
        cand = {s.lower().strip() for s in candidate_source if s}

    if isinstance(job_target, str):
        job = extract_skills(job_target)
    else:
        job = {s.lower().strip() for s in job_target if s}

    if not job:
        return {
            "score": 0.0,
            "direct_matches": [],
            "transfer_matches": [],
            "missing_skills": [],
            "asymmetric_transfer_ratio": 0.0,
        }

    direct = cand & job
    remaining_job = job - direct
    transfers = []
    transfer_score_sum = 0.0

    for target_skill in remaining_job:
        best_source = None
        best_weight = 0.0
        for source_skill in cand:
            weight = ASYMMETRIC_TRANSFER.get(source_skill, {}).get(target_skill, 0.0)
            if weight > best_weight:
                best_weight = weight
                best_source = source_skill
        if best_weight >= 0.4:
            transfers.append({
                "source": best_source,
                "target": target_skill,
                "weight": best_weight,
            })
            transfer_score_sum += best_weight

    total_matched_weight = len(direct) * 1.0 + transfer_score_sum
    score = min(total_matched_weight / max(len(job), 1), 1.0)
    transfer_targets = {t["target"] for t in transfers}
    missing = sorted(remaining_job - transfer_targets)

    return {
        "score": round(score, 3),
        "direct_matches": sorted(direct),
        "transfer_matches": transfers,
        "missing_skills": missing,
        "asymmetric_transfer_ratio": round(transfer_score_sum / max(len(job), 1), 3),
    }


def taxonomy_overlap(candidate_text: str, job_text: str) -> dict:
    """Weighted overlap: exact canonical matches count 1.0, directed transfer weights [0.4, 0.95]."""
    asym = compute_asymmetric_transfer(candidate_text, job_text)
    adjacent = [t["target"] for t in asym["transfer_matches"]]
    return {
        "score": asym["score"],
        "exact": asym["direct_matches"],
        "adjacent": sorted(adjacent),
        "asymmetric": asym,
    }
