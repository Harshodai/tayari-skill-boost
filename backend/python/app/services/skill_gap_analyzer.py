"""Skill Gap Analyzer service.
Compares candidate skills from resume text against required skills from a job description
or standard target role requirements using the ESCO/O*NET-inspired skill taxonomy.
"""
from typing import Dict, Any, List, Set
import logging
from app.services.skill_taxonomy import extract_skills, expand_skills, TAXONOMY

logger = logging.getLogger(__name__)

# Fallback occupation-to-skills mapping if no job description is provided
ROLE_DEFAULT_SKILLS: Dict[str, List[str]] = {
    "frontend": ["javascript", "typescript", "react", "frontend", "web development", "ui", "ux", "testing"],
    "backend": ["python", "go", "java", "backend", "databases", "postgresql", "rest api", "docker"],
    "fullstack": ["javascript", "typescript", "react", "frontend", "backend", "databases", "postgresql", "rest api"],
    "devops": ["docker", "kubernetes", "aws", "terraform", "ci/cd", "devops", "linux", "monitoring"],
    "data science": ["python", "machine learning", "deep learning", "ai", "data analysis", "statistics", "visualization"],
    "data engineering": ["python", "sql", "databases", "data engineering", "big data", "postgresql", "redis"],
    "product manager": ["product management", "agile", "project management", "leadership", "communication", "stakeholder management"],
}

class SkillGapAnalyzer:
    @staticmethod
    def analyze_gap(resume_text: str, job_description: str = "", target_role: str = "") -> Dict[str, Any]:
        """
        Analyze gaps between candidate resume and job requirements/target roles.
        """
        # Extract candidate skills
        candidate_skills = extract_skills(resume_text)
        
        # Determine required skills
        required_skills: Set[str] = set()
        
        if job_description:
            required_skills.update(extract_skills(job_description))
            
        # If required skills set is empty and target_role is provided, use default role mappings
        if not required_skills and target_role:
            role_lower = target_role.lower()
            for key, skills in ROLE_DEFAULT_SKILLS.items():
                if key in role_lower:
                    required_skills.update(skills)
                    break
            
            # Fallback if no specific role matches but we have target role string
            if not required_skills:
                required_skills.update(extract_skills(target_role))

        if not required_skills:
            return {
                "match_score": 100,
                "matched_skills": sorted(list(candidate_skills)),
                "adjacent_skills": [],
                "missing_skills": [],
                "required_skills": []
            }

        # Find exact matches
        matched_skills = candidate_skills & required_skills
        
        # Find expanded candidate skills for adjacent matches (e.g. knows python, so data analysis is adjacent)
        expanded_candidate = expand_skills(candidate_skills)
        adjacent_skills = (expanded_candidate & required_skills) - matched_skills
        
        # Calculate missing skills (required but not even adjacent)
        missing_skills = required_skills - matched_skills - adjacent_skills

        # Match score: exact matches get 1.0, adjacent matches get 0.4
        total_required = len(required_skills)
        score_value = (len(matched_skills) + 0.4 * len(adjacent_skills)) / total_required
        match_score = min(round(score_value * 100), 100)

        return {
            "match_score": match_score,
            "matched_skills": sorted(list(matched_skills)),
            "adjacent_skills": sorted(list(adjacent_skills)),
            "missing_skills": sorted(list(missing_skills)),
            "required_skills": sorted(list(required_skills))
        }
