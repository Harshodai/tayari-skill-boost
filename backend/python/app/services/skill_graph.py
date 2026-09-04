from __future__ import annotations
"""Seeded skill adjacency map (O*NET-inspired, in-code).

O*NET API needs credentials, unavailable by design, so adjacency is seeded
locally. Pure functions, stdlib only.
"""

ADJACENCY: dict[str, set[str]] = {
    "python": {"pandas", "numpy", "sql", "django", "flask", "fastapi"},
    "pandas": {"python", "numpy", "sql", "data analysis", "data engineering"},
    "numpy": {"python", "pandas", "machine learning"},
    "sql": {"python", "pandas", "postgresql", "mysql", "data engineering", "etl"},
    "data engineering": {"sql", "pandas", "etl", "airflow", "spark", "data pipeline"},
    "etl": {"sql", "data engineering", "airflow", "data pipeline"},
    "airflow": {"etl", "data engineering", "data pipeline", "python"},
    "spark": {"data engineering", "pandas", "sql", "stream processing"},
    "data pipeline": {"etl", "airflow", "data engineering"},
    "data analysis": {"pandas", "sql", "numpy"},
    "machine learning": {"numpy", "python", "pytorch", "tensorflow", "scikit-learn"},
    "pytorch": {"machine learning", "python", "tensorflow"},
    "tensorflow": {"machine learning", "python", "pytorch"},
    "postgresql": {"sql", "mysql"},
    "mysql": {"sql", "postgresql"},
    "django": {"python", "flask", "fastapi"},
    "flask": {"python", "django", "fastapi"},
    "fastapi": {"python", "django", "flask"},
    "javascript": {"typescript", "react", "node.js"},
    "typescript": {"javascript", "react", "node.js"},
    "react": {"javascript", "typescript"},
    "docker": {"kubernetes", "ci/cd"},
    "kubernetes": {"docker", "ci/cd"},
    "aws": {"docker", "kubernetes", "terraform"},
}


def _norm(s: str) -> str:
    return str(s or "").strip().lower()


def skill_adjacency_score(resume_skills: list[str], jd_skills: list[str]) -> float:
    resume = {_norm(s) for s in (resume_skills or []) if _norm(s)}
    jd = [_norm(s) for s in (jd_skills or []) if _norm(s)]
    if not jd:
        return 0.0
    total = 0.0
    for skill in jd:
        if skill in resume:
            total += 1.0
        elif any(skill in ADJACENCY.get(r, set()) for r in resume):
            total += 0.5
    return round(total / len(jd), 4)


def adjacent_missing(resume: list[str], jd: list[str]) -> list[str]:
    resume_set = {_norm(s) for s in (resume or []) if _norm(s)}
    out: list[str] = []
    for raw in jd or []:
        skill = _norm(raw)
        if not skill or skill in resume_set:
            continue
        if any(skill in ADJACENCY.get(r, set()) for r in resume_set):
            out.append(skill)
    return sorted(out)
