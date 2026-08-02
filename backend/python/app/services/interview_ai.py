"""
Interview AI — resume-aware mock interview generator with STAR coaching.
Uses Pydantic structured output models exclusively (zero regexes).
"""
import re
import random
from typing import Dict, Any, List, Optional

from app.llm.long_context import LongContextClient
from app.services.llm_service import llm_json
from app.schemas import (
    BehavioralPrepOutputSchema,
    TechnicalPrepOutputSchema,
    SystemDesignPrepOutputSchema,
)


class InterviewPrepGenerator:
    COMPANY_QUESTIONS = {
        "Amazon": {
            "principles": ["Customer Obsession", "Ownership", "Invent and Simplify", "Are Right, A Lot", "Learn and Be Curious", "Hire and Develop the Best", "Insist on the Highest Standards", "Think Big", "Bias for Action", "Frugality", "Earn Trust", "Dive Deep", "Have Backbone; Disagree and Commit", "Deliver Results", "Strive to be Earth's Best Employer", "Success and Scale Bring Broad Responsibility"],
            "patterns": ["Tell me about a time you had a conflict with a teammate.", "Describe a situation where you had to make a decision with incomplete data.", "Give me an example of when you went above and beyond for a customer."],
        },
        "Google": {
            "principles": ["Googliness", "Intellectual Humility", "Focus on the User", "Think 10x", "Embrace Ambiguity"],
            "patterns": ["Tell me about a time you failed and what you learned.", "Describe a complex project you led across multiple teams.", "How do you handle ambiguity in requirements?"],
        },
        "Meta": {
            "principles": ["Move Fast", "Be Bold", "Focus on Impact", "Be Open", "Build Social Value"],
            "patterns": ["Tell me about a time you took a big risk.", "Describe a time you had to move fast and break things.", "How do you prioritize impact over perfection?"],
        },
        "Netflix": {
            "principles": ["Freedom and Responsibility", "High Performance", "Context not Control", "Highly Aligned, Loosely Coupled", "Pay Top of Market"],
            "patterns": ["Tell me about a time you had to make a decision without manager approval.", "Describe how you handle feedback.", "How do you ensure high performance in your work?"],
        },
    }

    @staticmethod
    async def generate(
        resume_text: str,
        job_title: str,
        company_name: Optional[str] = None,
        job_description: Optional[str] = None,
        interview_type: str = "behavioral",
    ) -> Dict[str, Any]:
        if interview_type == "behavioral":
            return await InterviewPrepGenerator._behavioral(resume_text, job_title, company_name)
        elif interview_type == "technical":
            return await InterviewPrepGenerator._technical(resume_text, job_title, job_description)
        elif interview_type == "system-design":
            return await InterviewPrepGenerator._system_design(job_title, job_description)
        else:
            return await InterviewPrepGenerator._behavioral(resume_text, job_title, company_name)

    @staticmethod
    def _extract_bullets(resume_text: str) -> List[str]:
        bullets = []
        metric_pattern = re.compile(r'\b(reduced|increased|improved|led|launched|built|shipped|grew|saved|cut|boosted|optimized|designed|implemented|delivered|achieved|spearheaded|created|developed|managed|engineered|architected|refactored|automated|scaled|migrated|decreased|enhanced|accelerated|streamlined).+?\d+%?|\$?\d+[KkMmBb]?\b', re.IGNORECASE)
        for line in resume_text.split("\n"):
            line = line.strip()
            if len(line) > 20 and metric_pattern.search(line):
                bullets.append(line[:160])
        return bullets

    @staticmethod
    def _extract_skills(resume_text: str) -> List[str]:
        tech_skills = {
            "python", "javascript", "typescript", "java", "go", "rust", "c++", "c#", "ruby", "php", "swift", "kotlin",
            "react", "vue", "angular", "svelte", "next.js", "node.js", "express", "django", "flask", "fastapi",
            "kubernetes", "docker", "terraform", "aws", "gcp", "azure", "linux", "nginx", "jenkins", "github actions",
            "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "kafka", "rabbitmq",
            "graphql", "rest", "grpc", "microservices", "serverless", "lambda",
            "machine learning", "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
            "ci/cd", "devops", "sre", "data engineering", "data science", "analytics",
        }
        text_lower = resume_text.lower()
        found = [s for s in tech_skills if s in text_lower]
        return found[:8]

    @staticmethod
    async def _behavioral(resume_text: str, job_title: str, company_name: Optional[str] = None) -> Dict[str, Any]:
        bullets = InterviewPrepGenerator._extract_bullets(resume_text)
        if not bullets:
            bullets = ["Led cross-functional team to deliver product feature", "Improved system performance through optimization"]

        questions = []
        for i, bullet in enumerate(bullets[:5]):
            prompt = f'Given this resume bullet: "{bullet}"\nGenerate one behavioral question probing this achievement and a STAR answer outline.'
            res = await llm_json(
                system_message="You are an expert interview coach.",
                user_message=prompt,
                response_model=BehavioralPrepOutputSchema,
                tier="fast",
            )
            questions.append({
                "question": res.question,
                "category": "behavioral",
                "source_bullet": bullet,
                "star_suggested": res.star_suggested.model_dump(),
            })

        company_specific = None
        if company_name:
            for key, data in InterviewPrepGenerator.COMPANY_QUESTIONS.items():
                if key.lower() in company_name.lower():
                    company_specific = {
                        "company": key,
                        "principles": data["principles"],
                        "sample_questions": data["patterns"],
                    }
                    break

        return {
            "questions": questions,
            "interview_type": "behavioral",
            "company_specific": company_specific,
        }

    @staticmethod
    async def _technical(resume_text: str, job_title: str, job_description: Optional[str] = None) -> Dict[str, Any]:
        skills = InterviewPrepGenerator._extract_skills(resume_text)
        if not skills:
            skills = ["general programming"]

        # ponytail: chunked via long_context (spec 2026-08-02) — condense the
        # JD instead of head-slicing at [:1000]; fast path passes short JDs
        # through byte-identical with zero LLM calls.
        jd_context = (
            f"\nJob Description:\n{await LongContextClient().condense(job_description, kind='jd')}"
            if job_description
            else ""
        )
        prompt = (
            f"Candidate skills: {', '.join(skills)}\nJob Title: {job_title}{jd_context}\n"
            "Generate 5 technical interview questions for this role."
        )

        res = await llm_json(
            system_message="You are a technical interviewer.",
            user_message=prompt,
            response_model=TechnicalPrepOutputSchema,
            tier="fast",
        )

        questions = [q.model_dump() for q in res.questions]

        return {
            "questions": questions,
            "interview_type": "technical",
            "skills_tested": skills,
        }

    @staticmethod
    async def _system_design(job_title: str, job_description: Optional[str] = None) -> Dict[str, Any]:
        # ponytail: chunked via long_context (spec 2026-08-02) — same condense
        # treatment as _technical instead of [:1000].
        jd_context = (
            f"\nJob Description:\n{await LongContextClient().condense(job_description, kind='jd')}"
            if job_description
            else ""
        )
        prompt = f"Job Title: {job_title}{jd_context}\nGenerate 3 system design interview questions with requirements and suggested approach."

        res = await llm_json(
            system_message="You are a principal software architect.",
            user_message=prompt,
            response_model=SystemDesignPrepOutputSchema,
            tier="fast",
        )

        questions = [q.model_dump() for q in res.questions]

        return {
            "questions": questions,
            "interview_type": "system-design",
        }
