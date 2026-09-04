from __future__ import annotations
"""Deterministic (heuristic) ATS scoring engine.
Runs instantly without an LLM and gives a reproducible baseline score 0-100.
The LLM analysis layered on top refines this with semantic understanding.
"""
import math
import re
import logging
from collections import Counter
from typing import Any

from app.guardrails.pii_detector import check_pii
from app.services.embedding_service import embed_texts, cosine_similarity

logger = logging.getLogger(__name__)

SECTION_PATTERNS = {
    "experience": r"(work\s+experience|professional\s+experience|employment|experience)",
    "education": r"(education|academic|qualification)",
    "skills": r"(skills|technologies|technical\s+skills|competencies)",
    "summary": r"(summary|objective|profile|about)",
}

ACTION_VERBS = [
    "achieved", "built", "created", "delivered", "designed", "developed", "drove",
    "engineered", "established", "implemented", "improved", "increased", "launched",
    "led", "managed", "optimized", "reduced", "spearheaded", "streamlined", "transformed",
]

# Base stopwords — will be expanded with NLTK if available
_BASE_STOPWORDS = set(
    "a about above after again against all also am an and any are aren't as at be because "
    "been before being below between both but by can can't cannot could couldn't did didn't "
    "do does doesn't doing don't down during each few for from further get got had hadn't "
    "has hasn't have haven't having he he'd he'll he's her here here's hers herself him "
    "himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself "
    "let's ll me more most mustn't my myself no nor not of off on once only or other ought "
    "our ours ourselves out over own re s same shan't she she'd she'll she's should "
    "shouldn't so some such t than that that's the their theirs them themselves then "
    "there there's these they they'd they'll they're they've this those through to too "
    "under until up ve very was wasn't we we'd we'll we're we've were weren't what "
    "what's when when's where where's which while who who's whom why why's will with "
    "won't would wouldn't you you'd you'll you're you've your yours yourself yourselves".split()
)

def _build_stopwords() -> set:
    """Build a comprehensive stopword set, augmenting with NLTK if available."""
    sw = set(_BASE_STOPWORDS)
    try:
        import nltk
        try:
            from nltk.corpus import stopwords as nltk_sw
            sw |= set(nltk_sw.words('english'))
        except LookupError:
            nltk.download('stopwords', quiet=True)
            from nltk.corpus import stopwords as nltk_sw
            sw |= set(nltk_sw.words('english'))
    except Exception:
        pass  # NLTK unavailable — base stopwords are still comprehensive
    return sw

STOPWORDS = _build_stopwords()

# Curated technical skill terms — these are ALWAYS kept even if short
TECH_SKILL_WHITELIST: set[str] = {
    # Languages
    "python", "sql", "java", "scala", "go", "rust", "c++", "c#", "r",
    "typescript", "javascript", "bash", "ruby", "kotlin", "swift",
    # Data & ML
    "spark", "kafka", "airflow", "dbt", "pandas", "numpy", "sklearn",
    "tensorflow", "pytorch", "mlflow", "ray", "dask", "flink",
    "machine learning", "deep learning", "nlp", "llm", "rag", "embeddings",
    "feature engineering", "model training", "model serving", "data pipeline",
    "etl", "elt", "data warehousing", "data lake", "data lakehouse",
    "apache iceberg", "apache spark", "apache kafka", "apache flink",
    # Cloud & Infra
    "aws", "gcp", "azure", "kubernetes", "docker", "terraform", "ci/cd",
    "s3", "ec2", "lambda", "bigquery", "redshift", "snowflake", "databricks",
    "prometheus", "grafana", "datadog", "opentelemetry",
    # Distributed systems
    "distributed systems", "microservices", "event-driven", "stream processing",
    "batch processing", "high availability", "fault tolerance", "load balancing",
    "api design", "rest", "grpc", "graphql",
    # Stripe/Fintech relevant
    "payments", "billing", "revenue", "financial infrastructure", "data engineering",
    "data platform", "data ops", "incident management", "oncall",
}

# --- Scoring constants (single source of truth for thresholds/bands) -------
# ponytail: named instead of magic numbers so the score/band logic and the UI
# thresholds stay traceable. UI mirrors ATS_SCORE_HIGH/MED in ResumeResults.
ATS_SCORE_HIGH = 80      # "High"/"Excellent" threshold; also the plateau cutoff
ATS_SCORE_MEDIUM = 60    # "Medium"/"Good" threshold
ATS_PLATEAU_THRESHOLD = ATS_SCORE_HIGH  # above this → bottleneck = interview signal
_CURRENT_YEAR = 2026     # ponytail: pinned; swap for date-based if multi-year runs matter

# Per-ATS confidence band widths (±). Wider when signals disagree (no JD) or
# the score sits near the 50/50 uncertainty line.
_ATS_BAND_WIDE = 10      # no keyword signal available
_ATS_BAND_MEDIUM = 8     # score within ±15 of 50 (uncertain)
_ATS_BAND_NARROW = 6     # score far from 50 (signals converge)
_ATS_BAND_WIDEN_NEAR = 15  # distance from 50 that triggers the medium band


def _tokenize(text: str) -> set:
    """Tokenize text, filtering stopwords but always keeping tech skill whitelist terms."""
    tokens = set()
    for t in re.findall(r"[a-zA-Z][a-zA-Z+#./\-]{1,}", text.lower()):
        if t in TECH_SKILL_WHITELIST:
            tokens.add(t)
        elif t not in STOPWORDS and len(t) > 2:
            tokens.add(t)
    return tokens


def _bigrams(text: str) -> set:
    """Exact 2-word phrases — ATS keyword matching favors exact phrases over
    single tokens (e.g. 'machine learning', 'project management')."""
    words = [w for w in re.findall(r"[a-zA-Z][a-zA-Z+#.\-]*", text.lower())
             if w not in STOPWORDS and len(w) > 2]
    bigram_set = {f"{a} {b}" for a, b in zip(words, words[1:])}
    # Also check tech skill whitelist bigrams
    for skill in TECH_SKILL_WHITELIST:
        if ' ' in skill and skill in text.lower():
            bigram_set.add(skill)
    return bigram_set


def _tfidf_cosine_similarity(text_a: str, text_b: str) -> float:
    """Compute TF-IDF cosine similarity between two documents using pure Python/math.
    Returns a float 0.0–1.0. No external ML packages required.
    """
    def tokenize_for_tfidf(text: str) -> list[str]:
        tokens = re.findall(r"[a-zA-Z][a-zA-Z+#.\-]{1,}", text.lower())
        return [t for t in tokens if t not in STOPWORDS and len(t) > 1]

    tokens_a = tokenize_for_tfidf(text_a)
    tokens_b = tokenize_for_tfidf(text_b)
    if not tokens_a or not tokens_b:
        return 0.0

    vocab = set(tokens_a) | set(tokens_b)
    freq_a = Counter(tokens_a)
    freq_b = Counter(tokens_b)

    # TF = term_count / total_terms
    def tf(freq: Counter, total: int) -> dict:
        return {t: freq[t] / total for t in freq}

    tf_a = tf(freq_a, len(tokens_a))
    tf_b = tf(freq_b, len(tokens_b))

    # IDF = log(2 / (1 + docs_containing_term)) — 2 docs total
    idf = {}
    for term in vocab:
        in_a = 1 if term in freq_a else 0
        in_b = 1 if term in freq_b else 0
        idf[term] = math.log(2 / (1 + in_a + in_b) + 1)  # smoothed

    # TF-IDF vectors
    vec_a = {t: tf_a.get(t, 0) * idf[t] for t in vocab}
    vec_b = {t: tf_b.get(t, 0) * idf[t] for t in vocab}

    # Cosine similarity
    dot = sum(vec_a[t] * vec_b[t] for t in vocab)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return round(dot / (mag_a * mag_b), 4)


def semantic_similarity_score(resume_text: str, job_description: str) -> dict:
    """Compute semantic similarity between resume and JD using embedding similarity.
    
    Uses embedding-based similarity (BAAI/bge-small-en-v1.5 via fastembed) for
    true semantic understanding. Falls back to TF-IDF cosine similarity if embeddings
    are unavailable.
    
    Returns a dict with score (0-100 int), raw_similarity (-1.0 to 1.0), and interpretation.
    """
    result = semantic_ats_score(resume_text, job_description)
    return result


def categorize_jd_keywords(job_description: str) -> dict:
    """Categorize JD keywords into hard skills, soft skills, and domain terms.
    Returns dict with keys: hard_skills, soft_skills, domain_keywords.
    """
    SOFT_SKILL_PATTERNS = [
        "collaboration", "communication", "leadership", "cross-functional", "mentoring",
        "problem-solving", "analytical", "stakeholder", "initiative", "strategic",
        "ownership", "ambiguity", "fast-paced", "data-driven", "decision-making",
        "teamwork", "adaptable", "detail-oriented", "self-motivated", "curious",
    ]
    DOMAIN_PATTERNS = [
        "payments", "fintech", "saas", "enterprise", "startup", "e-commerce",
        "healthcare", "infrastructure", "platform", "marketplace", "revenue",
        "compliance", "regulatory", "financial", "banking", "insurance",
        "data engineering", "data platform", "ml platform", "ai platform",
    ]
    jd_lower = job_description.lower()
    all_tokens = _tokenize(job_description)
    all_bigrams_set = _bigrams(job_description)
    all_terms = all_tokens | all_bigrams_set

    hard_skills = set()
    soft_skills = set()
    domain_keywords = set()

    for term in all_terms:
        if term in TECH_SKILL_WHITELIST:
            hard_skills.add(term)
        elif any(soft in term for soft in SOFT_SKILL_PATTERNS):
            soft_skills.add(term)
        elif any(dom in term for dom in DOMAIN_PATTERNS):
            domain_keywords.add(term)

    # Also catch multi-word whitelist skills in bigrams
    for skill in TECH_SKILL_WHITELIST:
        if ' ' in skill and skill in jd_lower:
            hard_skills.add(skill)

    return {
        "hard_skills": sorted(hard_skills),
        "soft_skills": sorted(soft_skills),
        "domain_keywords": sorted(domain_keywords),
    }


def _extract_jd_title(job_description: str) -> str:
    """Best-effort job title from a JD: first short non-sentence line."""
    for line in job_description.splitlines():
        line = line.strip()
        if 2 < len(line) < 70 and not line.endswith(('.', ':')):
            return line
    return ""


def _keyword_stuffing_evidence(resume_text: str, job_description: str | None) -> dict:
    """Measure repeated JD terms without treating repetition as relevance.

    Unsupported-claim checking requires candidate-source provenance and is
    therefore explicitly reported as not evaluated here rather than guessed.
    """
    if not job_description or not job_description.strip():
        return {
            "status": "not_evaluated",
            "repeated_terms": [],
            "stuffing_penalty": 0,
            "reason": "job description is required",
        }
    jd_terms = _tokenize(job_description)
    resume_tokens = re.findall(r"[a-zA-Z][a-zA-Z+#./\\-]{1,}", (resume_text or "").lower())
    resume_terms = Counter(token for token in resume_tokens if token in jd_terms)
    repeated = sorted(
        (term, count)
        for term, count in resume_terms.items()
        if term in jd_terms and count >= 4
    )
    excess = sum(count - 3 for _, count in repeated)
    penalty = min(20, round(excess * 2))
    return {
        "status": "evaluated",
        "repeated_terms": [{"term": term, "count": count} for term, count in repeated[:20]],
        "stuffing_penalty": penalty,
        "reason": "repeated job-description terms are capped and reduce the diagnostic score"
        if penalty else "no material repeated-term signal detected",
    }


def heuristic_ats_score(resume_text: str, job_description: str | None = None) -> dict:
    text = resume_text or ""

    # PII guardrail on input
    pii_result = check_pii(text)

    lower = text.lower()
    words = text.split()
    word_count = len(words)
    checks = []

    def add_check(name, passed, weight, detail):
        checks.append({"name": name, "passed": bool(passed), "weight": weight, "detail": detail})

    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text))
    has_phone = bool(re.search(r"(\+?\d[\d\s().-]{8,}\d)", text))
    add_check("Contact email", has_email, 8, "Recruiters need an email to reach you")
    add_check("Phone number", has_phone, 5, "Add a phone number for faster contact")

    found_sections = []
    for section, pattern in SECTION_PATTERNS.items():
        if re.search(pattern, lower):
            found_sections.append(section)
    add_check("Experience section", "experience" in found_sections, 12,
              "A clear experience section is the #1 thing ATS parsers look for")
    add_check("Education section", "education" in found_sections, 8,
              "List your education with dates")
    add_check("Skills section", "skills" in found_sections, 12,
              "A dedicated skills section maximizes keyword matching")
    add_check("Summary / objective", "summary" in found_sections, 5,
              "A short professional summary helps both ATS and recruiters")

    good_length = 300 <= word_count <= 1100
    add_check("Optimal length", good_length, 8,
              f"Resume has {word_count} words (ideal: 300-1100, roughly 1-2 pages)")

    bullet_count = len(re.findall(r"(?m)^\s*[•\-\*\u2022]", text))
    add_check("Bullet points", bullet_count >= 5, 8,
              f"{bullet_count} bullet points found - bullets improve ATS parsing")

    verb_hits = sum(1 for v in ACTION_VERBS if v in lower)
    add_check("Action verbs", verb_hits >= 5, 8,
              f"{verb_hits} strong action verbs found (led, built, improved...)")

    quantified = len(re.findall(r"\d+\s*%|\$\s*\d|\d+[kKmM]\+?|\b\d{2,}\b", text))
    add_check("Quantified achievements", quantified >= 5, 10,
              f"{quantified} numbers/metrics found - quantified results rank higher")

    has_dates = bool(re.search(
        r"(19|20)\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", lower))
    add_check("Dates present", has_dates, 6, "ATS systems extract employment dates")

    # Recency: parsers and ranking models weight recent experience heavily
    years = [int(y) for y in re.findall(r"\b(19\d{2}|20\d{2})\b", text)]
    is_recent = bool(years) and max(years) >= _CURRENT_YEAR - 1
    add_check("Recent experience visible", is_recent, 5,
              "Most recent role should show a current/last-year date (or 'Present')"
              if not ("present" in lower or "current" in lower) else
              "Current role detected - recency signal is strong")
    if "present" in lower or "current" in lower:
        checks[-1]["passed"] = True

    keyword_score_pct = None
    matched_keywords: list = []
    missing_keywords: list = []
    if job_description and job_description.strip():
        jd_tokens = _tokenize(job_description)
        resume_tokens = _tokenize(text)
        overlap = jd_tokens & resume_tokens

        # Exact phrase (bigram) matching - exact phrases outrank single tokens in ATS
        jd_phrases = _bigrams(job_description)
        resume_phrases = _bigrams(text)
        phrase_overlap = jd_phrases & resume_phrases
        phrase_pct = round(100 * len(phrase_overlap) / max(len(jd_phrases), 1))

        token_pct = round(100 * len(overlap) / max(len(jd_tokens), 1))
        keyword_score_pct = round(0.7 * token_pct + 0.3 * phrase_pct)

        # Filter matched/missing to only surface meaningful skills & nouns (no stopwords)
        # Prioritize tech skill whitelist terms in reporting
        def _is_meaningful(kw: str) -> bool:
            """Only surface terms that carry real signal — skills, nouns, multi-word phrases."""
            if kw in TECH_SKILL_WHITELIST:
                return True
            if ' ' in kw:  # bigrams are always meaningful
                return True
            if len(kw) < 4:  # skip very short tokens like 'll', 're', etc.
                return False
            # Skip words that are clearly not skills/nouns (common adjectives, prepositions)
            NON_SKILL_SUFFIXES = ('ing', 'tion', 'ment', 'ness', 'ful', 'less', 'ive', 'ous')
            if kw.endswith(NON_SKILL_SUFFIXES) and len(kw) < 7:
                return False
            return True

        matched_keywords = sorted(kw for kw in overlap if _is_meaningful(kw))[:30]
        missing_keywords = sorted(kw for kw in (jd_tokens - resume_tokens) if _is_meaningful(kw))[:30]
        add_check("Job keyword match", keyword_score_pct >= 45, 10,
                  f"{keyword_score_pct}% weighted keyword/phrase coverage of the job description")

        # Job-title alignment - a major ATS visibility filter
        jd_title = _extract_jd_title(job_description)
        if jd_title:
            title_tokens = _tokenize(jd_title)
            title_hit = bool(title_tokens) and \
                len(title_tokens & resume_tokens) >= max(1, len(title_tokens) // 2)
            add_check("Job title alignment", title_hit, 7,
                      f"Resume {'mentions' if title_hit else 'should mention'} the target "
                      f"title wording: '{jd_title[:50]}'")

    total_weight = sum(c["weight"] for c in checks)
    earned = sum(c["weight"] for c in checks if c["passed"])
    score_before_penalties = round(100 * earned / max(total_weight, 1))
    stuffing = _keyword_stuffing_evidence(text, job_description)
    score = max(0, score_before_penalties - stuffing["stuffing_penalty"])

    try:
        from app.services.skill_graph import skill_adjacency_score
        if job_description and job_description.strip():
            jd_skills = categorize_jd_keywords(job_description).get("hard_skills", [])
            resume_skills = categorize_jd_keywords(text).get("hard_skills", [])
            semantic_adjacency = round(skill_adjacency_score(resume_skills, jd_skills) * 100)
        else:
            # 0 means unavailable (no JD signal), not a measured zero-overlap.
            semantic_adjacency = 0
    except Exception:
        # 0 means unavailable (adjacency unavailable), not a measured zero-overlap.
        semantic_adjacency = 0

    return {
        "score": score,
        "ats_score": score,
        "semantic_adjacency": semantic_adjacency,
        "score_before_penalties": score_before_penalties,
        "evidence": {
            "keyword_coverage_pct": keyword_score_pct,
            "stuffing": stuffing,
            "unsupported_claims": {
                "status": "not_evaluated",
                "penalty": 0,
                "reason": "claim verification requires source-linked candidate evidence",
            },
            "confidence": per_ats_estimate(checks, keyword_score_pct)["confidence"],
        },
        "category_scores": checks,
        "word_count": word_count,
        "sections_found": found_sections,
        "checks": checks,
        "keyword_match_pct": keyword_score_pct,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "pii_check": pii_result,
        "per_ats": per_ats_estimate(checks, keyword_score_pct),
    }


# ponytail: per-ATS estimate is a heuristic REWEIGHTING of the same checks the
# single score uses — no new model. Different ATS parsers emphasize different
# dimensions (Workday weights format, Greenhouse weights keyword relevance,
# iCIMS weights contact + achievements). Confidence band widens when signals
# disagree (no JD → keyword checks absent → wider band). Ceiling: a real
# per-ATS parser would differ; this is an honest estimate, not a benchmark.
_ATS_WEIGHT_PROFILES = {
    "workday": {
        "Experience section": 1.4, "Education section": 1.3, "Skills section": 1.4,
        "Optimal length": 1.3, "Bullet points": 1.3, "Dates present": 1.3,
        "Job keyword match": 0.8, "Job title alignment": 0.9,
    },
    "greenhouse": {
        "Job keyword match": 1.6, "Job title alignment": 1.5,
        "Skills section": 1.2, "Action verbs": 1.1, "Quantified achievements": 1.1,
    },
    "icims": {
        "Contact email": 1.4, "Phone number": 1.3, "Quantified achievements": 1.4,
        "Action verbs": 1.3, "Recent experience visible": 1.2,
    },
}


def per_ats_estimate(checks: list, keyword_match_pct: int | None) -> dict:
    """Per-ATS score estimates + confidence band from existing check dimensions.

    Returns {estimates: {workday, greenhouse, icims}, band, confidence, plateau_note}.
    """
    estimates: dict[str, int] = {}
    for ats, profile in _ATS_WEIGHT_PROFILES.items():
        total = 0.0
        earned = 0.0
        for c in checks:
            w = c["weight"] * profile.get(c["name"], 1.0)
            total += w
            if c["passed"]:
                earned += w
        estimates[ats] = round(100 * earned / max(total, 1))
    base = max(estimates.values()) if estimates else 0
    # band widens when the keyword signal is absent (no JD) and when the score
    # sits near 50 — both mean the underlying signals are weak/disagreeing.
    if keyword_match_pct is None:
        band = _ATS_BAND_WIDE
    elif abs(base - 50) < _ATS_BAND_WIDEN_NEAR:
        band = _ATS_BAND_MEDIUM
    else:
        band = _ATS_BAND_NARROW
    plateau = (
        "Above 80 the bottleneck shifts from keywords to interview signal — start interview prep."
        if base >= ATS_PLATEAU_THRESHOLD else None
    )
    return {
        "estimates": estimates,
        "band": band,
        "confidence": f"±{band}",
        "plateau_note": plateau,
    }


def semantic_ats_score(resume_text: str, job_description: str) -> dict:
    """Compute semantic ATS score using embedding-based similarity.
    
    Uses sentence-transformers/BGE embeddings to compute true semantic
    similarity between resume and job description, making it much harder
    to game than the heuristic keyword-based scorer.
    
    Returns dict with score (0-100 int), raw_similarity (-1.0 to 1.0),
    and interpretation.
    """
    # Ensure inputs are strings
    resume_text = resume_text or ""
    job_description = job_description or ""
    
    # Generate embeddings for both texts
    vectors = embed_texts([resume_text, job_description])
    if vectors is None or len(vectors) < 2:
        # Fall back to TF-IDF semantic similarity
        raw = _tfidf_cosine_similarity(resume_text, job_description)
        score = round(raw * 100)
        if score >= 75:
            interp = "Strong semantic match — resume language closely mirrors the JD"
        elif score >= 50:
            interp = "Moderate semantic match — some alignment but gaps in terminology"
        elif score >= 30:
            interp = "Weak semantic match — resume language diverges from JD significantly"
        else:
            interp = "Very low semantic match — major terminology mismatch with target role"
        return {"score": score, "raw_similarity": raw, "interpretation": interp, "method": "tfidf_fallback"}
    
    resume_vec = vectors[0]
    jd_vec = vectors[1]
    
    raw_sim = cosine_similarity(resume_vec, jd_vec)
    # Map cosine similarity [-1, 1] to score [0, 100]
    score = round((raw_sim + 1) / 2 * 100)
    
    if score >= 80:
        interp = "Strong semantic match — resume content closely aligns with job requirements"
    elif score >= 60:
        interp = "Moderate semantic match — some relevant alignment but significant gaps"
    elif score >= 40:
        interp = "Weak semantic match — resume language diverges from JD; major rework needed"
    else:
        interp = "Very low semantic match — resume is not well-suited for this job description"
    
    return {"score": score, "raw_similarity": raw_sim, "interpretation": interp, "method": "embedding"}


# AI Phrase Blacklist - Words and phrases that sound AI-generated or cliché
AI_PHRASE_BLACKLIST: set[str] = {
    # Action verbs (overused in AI resume writing)
    "spearheaded", "orchestrated", "championed", "synergized", "leveraged",
    "revolutionized", "pioneered", "catalyzed", "operationalized", "architected",
    "envisioned", "effectuated", "endeavored", "facilitated", "utilized",
    # Corporate buzzwords
    "synergy", "synergies", "paradigm", "paradigm shift", "best-in-class",
    "world-class", "cutting-edge", "bleeding-edge", "game-changer", "game-changing",
    "disruptive", "disruptor", "holistic", "robust", "scalable", "actionable",
    "impactful", "proactive", "proactively", "stakeholder", "deliverables",
    "bandwidth", "circle back", "deep dive", "move the needle", "low-hanging fruit",
    "touch base", "value-add",
    # Filler phrases
    "in order to", "for the purpose of", "with a view to", "at the end of the day",
    "moving forward", "going forward", "on a daily basis", "on a regular basis",
    "in a timely manner", "at this point in time", "due to the fact that",
    "in the event that", "in light of the fact that",
}

# Replacements for AI phrases - maps AI phrase to simpler alternative
AI_PHRASE_REPLACEMENTS: dict[str, str] = {
    # Action verb replacements
    "spearheaded": "led",
    "orchestrated": "coordinated",
    "championed": "advocated for",
    "synergized": "collaborated",
    "leveraged": "used",
    "revolutionized": "transformed",
    "pioneered": "introduced",
    "catalyzed": "initiated",
    "operationalized": "implemented",
    "architected": "designed",
    "envisioned": "planned",
    "effectuated": "completed",
    "endeavored": "worked",
    "facilitated": "helped",
    "utilized": "used",
    # Buzzword replacements
    "synergy": "collaboration",
    "synergies": "collaborations",
    "paradigm": "approach",
    "paradigm shift": "change",
    "best-in-class": "top-performing",
    "world-class": "high-quality",
    "cutting-edge": "modern",
    "bleeding-edge": "modern",
    "game-changer": "innovation",
    "game-changing": "innovative",
    "disruptive": "innovative",
    "holistic": "comprehensive",
    "robust": "strong",
    "scalable": "expandable",
    "actionable": "practical",
    "impactful": "effective",
    "proactive": "active",
    "proactively": "actively",
    "stakeholder": "team member",
    "deliverables": "outputs",
    "bandwidth": "capacity",
    "circle back": "follow up",
    "deep dive": "analysis",
    "move the needle": "make progress",
    "low-hanging fruit": "quick wins",
    "touch base": "connect",
    "value-add": "benefit",
    # Phrase simplifications
    "in order to": "to",
    "for the purpose of": "to",
    "with a view to": "to",
    "at the end of the day": "",
    "moving forward": "",
    "going forward": "",
    "on a daily basis": "daily",
    "on a regular basis": "regularly",
    "in a timely manner": "promptly",
    "at this point in time": "now",
    "due to the fact that": "because",
    "in the event that": "if",
    "in light of the fact that": "since",
}


def keyword_in_text(keyword: str, text: str) -> bool:
    """Check if keyword exists as a whole term/phrase in text (case-insensitive boundary match)."""
    if not keyword or not text:
        return False
    # Use negative lookarounds to match boundaries including special characters like +, #, .
    pattern = rf"(?<![\w#+.])" + re.escape(keyword.lower()) + rf"(?![\w#+.])"
    return bool(re.search(pattern, text.lower()))


_TERM_PATTERN = r"(?<![\w#+.])[A-Za-z0-9+#.]{3,}(?![\w#+.])"
# ponytail: lookaround term boundaries (same special-char rules as keyword_in_text)
# keep C++ / .NET / C# intact; \b-word-boundary regexes silently strip them.
# The "." in the term class can swallow a sentence-final period ("Docker."), so both
# helpers rstrip(".") — interior dots (node.js, .NET) survive, trailing ones don't.
# Terms of exactly 2 chars ("go", "ai", "C#") stay dropped from the vocabulary, matching the pre-audit filter.

# ponytail: best-effort salary parse — only $ or k-suffixed numbers count, so prose
# figures ("5+ years") don't pollute the bounds; whole-word $ ranges are out of scope.
_SALARY_RE = re.compile(r"\$\s*([\d,]+)(\s*k|K)?|([\d,]+)\s*[kK]")

_WORK_MODE_ALIASES = {
    "remote": ("remote",),
    "hybrid": ("hybrid",),
    "onsite": ("onsite", "on-site", "in-office", "in office", "in-person", "in person", "office"),
}


def extract_jd_keywords(jd_text: str) -> list[str]:
    """Extract technical keywords from job description text (special-char aware, first-seen order)."""
    seen: set[str] = set()
    keywords: list[str] = []
    for word in re.findall(_TERM_PATTERN, jd_text):
        word = word.rstrip(".")
        key = word.lower()
        if len(key) > 2 and key not in seen:
            seen.add(key)
            keywords.append(word)
    return keywords


def _term_set(text: str) -> set[str]:
    """Lowercased term set of text, using the same boundaries as extract_jd_keywords."""
    return {word.rstrip(".").lower() for word in re.findall(_TERM_PATTERN, text) if len(word.rstrip(".")) > 2}


def _jd_compensation_bounds(jd_text: str) -> tuple[float | None, float | None]:
    """Best-effort (low, high) salary bounds from $ / k-suffixed numbers in job description text."""
    values: list[float] = []
    for match in _SALARY_RE.finditer(jd_text):
        number = match.group(1) or match.group(3)
        value = float(number.replace(",", ""))
        if match.group(2) or match.group(3):
            value *= 1000.0
        values.append(value)
    if not values:
        return (None, None)
    return (values[0], values[1] if len(values) > 1 else None)


def _jd_work_modes(jd_text: str) -> set[str]:
    """Work modes explicitly mentioned in job description text."""
    low = jd_text.lower()
    return {mode for mode, aliases in _WORK_MODE_ALIASES.items() if any(alias in low for alias in aliases)}


def evaluate_5d_fit(
    resume_text: str,
    jd_text: str,
    candidate_skills: list[str] | None = None,
    candidate_compensation: float | int | None = None,
    candidate_work_mode: str | None = None,
) -> dict[str, Any]:
    """Evaluate job application fit across 5 explicit dimensions (ai-job-search architecture).

    Compensation/logistics are scored only when the candidate constraint is supplied;
    otherwise they are marked not_evaluated and excluded from overall_fit weighting.
    """
    resume_terms = _term_set(resume_text)
    keywords = extract_jd_keywords(jd_text)

    # Candidate skill vocabulary: explicit skills when provided, else the terms the
    # resume text itself demonstrates (set-based, so no per-keyword regex scan).
    if candidate_skills is not None:
        candidate_terms = {s.strip().lower() for s in candidate_skills}
        candidate_terms = {s for s in candidate_terms if len(s) > 2}
    else:
        candidate_terms = resume_terms

    # ponytail: required vocabulary = JD keywords minus STOPWORDS, so prose words
    # ("and", "with", "need") can't count as required skills or inflate the denominator.
    required = [kw for kw in keywords if kw.lower() not in STOPWORDS]
    matched = [kw for kw in required if kw.lower() in candidate_terms]
    missing = [kw for kw in required if kw.lower() not in candidate_terms]

    # 1. Technical Fit (0-100): same vocabulary for denominator and matched count.
    tech_score = int((len(matched) / max(len(required), 1)) * 100)

    # 2. Experience Level Fit (0-100)
    seniority_terms = ["senior", "lead", "principal", "staff", "manager", "director"]
    jd_seniority = any(s in jd_text.lower() for s in seniority_terms)
    res_seniority = any(s in resume_text.lower() for s in seniority_terms)
    exp_score = 90 if (jd_seniority == res_seniority) else 65

    # 3. Culture & Role Alignment (0-100)
    culture_words = ["ownership", "agile", "collaborative", "fast-paced", "cross-functional", "innovative", "remote"]
    matched_culture = [w for w in culture_words if w in jd_text.lower() and w in resume_text.lower()]
    culture_score = min(50 + len(matched_culture) * 15, 100)

    # 4. Compensation / Market Alignment (0-100): candidate constraint vs JD range.
    compensation_evaluated = candidate_compensation is not None
    if compensation_evaluated:
        jd_low, _ = _jd_compensation_bounds(jd_text)
        if not jd_low:
            comp_score = 50  # ponytail: JD states no salary — neutral midpoint, nothing fabricated
        else:
            comp_score = 100 if candidate_compensation >= jd_low else int((candidate_compensation / jd_low) * 100)
    else:
        comp_score = 0

    # 5. Logistics & Work Mode Score (0-100): candidate mode vs JD work-mode mentions.
    logistics_evaluated = candidate_work_mode is not None
    if logistics_evaluated:
        mode = candidate_work_mode.strip().lower()
        normalized_mode = "onsite" if mode in _WORK_MODE_ALIASES["onsite"] else mode
        jd_modes = _jd_work_modes(jd_text)
        if normalized_mode in jd_modes:
            logistics_score = 100
        elif jd_modes:
            logistics_score = 40
        else:
            logistics_score = 50  # ponytail: JD states no work mode — neutral midpoint, nothing fabricated
    else:
        logistics_score = 0

    dimension_scores = {
        "technical_fit": tech_score,
        "experience_fit": exp_score,
        "culture_fit": culture_score,
        "compensation_fit": comp_score,
        "logistics_fit": logistics_score,
    }
    dimension_status = {
        "technical_fit": "evaluated",
        "experience_fit": "evaluated",
        "culture_fit": "evaluated",
        "compensation_fit": "evaluated" if compensation_evaluated else "not_evaluated",
        "logistics_fit": "evaluated" if logistics_evaluated else "not_evaluated",
    }

    weighted = [
        ("technical_fit", tech_score, 0.4),
        ("experience_fit", exp_score, 0.2),
        ("culture_fit", culture_score, 0.15),
    ]
    if compensation_evaluated:
        weighted.append(("compensation_fit", comp_score, 0.15))
    if logistics_evaluated:
        weighted.append(("logistics_fit", logistics_score, 0.1))
    weight_sum = sum(weight for _, _, weight in weighted)
    # ponytail: re-normalize over evaluated dimensions only; round() (not int()) so
    # float weight sums (~1.0000000000000002) can't truncate an exact score by 1.
    overall_fit = int(round(sum(score * weight for _, score, weight in weighted) / weight_sum)) if weight_sum else 0

    return {
        "overall_fit_score": overall_fit,
        "dimensions": {
            name: {"score": score, "status": dimension_status[name]}
            for name, score in dimension_scores.items()
        },
        "matched_skills": matched[:15],
        "missing_skills": missing[:15],
        "radar_metrics": [
            {"dimension": "Technical Skills", "score": tech_score, "status": dimension_status["technical_fit"]},
            {"dimension": "Experience Fit", "score": exp_score, "status": dimension_status["experience_fit"]},
            {"dimension": "Culture Fit", "score": culture_score, "status": dimension_status["culture_fit"]},
            {"dimension": "Compensation", "score": comp_score, "status": dimension_status["compensation_fit"]},
            {"dimension": "Logistics", "score": logistics_score, "status": dimension_status["logistics_fit"]},
        ],
    }


