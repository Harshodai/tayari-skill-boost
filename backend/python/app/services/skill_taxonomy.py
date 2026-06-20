"""Lightweight skill taxonomy (ESCO/O*NET-inspired, curated).
Maps surface forms to canonical skills and models skill adjacency so matching
generalizes beyond exact keywords ('pandas' relates to 'data analysis', 'react'
implies 'frontend'). Used by the hybrid job-matching pipeline.
"""
import re

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


def taxonomy_overlap(candidate_text: str, job_text: str) -> dict:
    """Weighted overlap: exact canonical matches count 1.0, adjacency 0.4."""
    cand = extract_skills(candidate_text)
    job = extract_skills(job_text)
    if not job:
        return {"score": 0.0, "exact": [], "adjacent": []}
    exact = cand & job
    cand_expanded = expand_skills(cand)
    adjacent = (cand_expanded & job) - exact
    score = (len(exact) + 0.4 * len(adjacent)) / len(job)
    return {"score": min(score, 1.0), "exact": sorted(exact), "adjacent": sorted(adjacent)}
