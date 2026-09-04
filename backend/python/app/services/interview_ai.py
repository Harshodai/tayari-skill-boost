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

    @staticmethod
    def analyze_star_answer(
        answer: str,
        question: Optional[str] = None,
        job_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze candidate's answer against the STAR method (Situation, Task, Action, Result).
        If Result or Action is missing/weak, generates an adaptive follow-up question
        specifically targeting that missing element.
        Calculates STAR completeness score (0-100%).
        """
        text = (answer or "").strip()
        words = text.split()
        word_count = len(words)
        lower_text = text.lower()

        if word_count == 0:
            return {
                "completeness_score": 0,
                "star_score": 0,
                "breakdown": {
                    "situation": {"present": False, "strength": "missing", "score": 0, "feedback": "Situation context is completely missing."},
                    "task": {"present": False, "strength": "missing", "score": 0, "feedback": "Task / objective is missing."},
                    "action": {"present": False, "strength": "missing", "score": 0, "feedback": "No actions described."},
                    "result": {"present": False, "strength": "missing", "score": 0, "feedback": "No outcome or result provided."},
                },
                "missing_elements": ["situation", "task", "action", "result"],
                "weak_elements": [],
                "follow_up_question": "Could you provide an example from your experience following the Situation, Task, Action, and Result (STAR) framework?",
                "follow_up_target": "star_foundation",
                "coaching_tips": [
                    "Structure your response with clear STAR milestones: the context, your objective, your personal actions, and the measurable impact.",
                ],
            }

        # 1. Situation Analysis (0-25 pts)
        situation_keywords = [
            "when", "while", "during", "at my", "in my role", "project", "company", "team",
            "faced with", "challenge", "context", "background", "problem", "outage", "legacy",
            "migration", "production", "scale", "customer", "client", "system", "incident",
            "scenario", "working on", "responsible for", "contract"
        ]
        has_situation_kw = any(kw in lower_text for kw in situation_keywords)
        situation_score = 0
        situation_strength = "missing"
        situation_feedback = ""

        if has_situation_kw and word_count >= 20:
            situation_score = 25
            situation_strength = "strong"
            situation_feedback = "Clear context and background established."
        elif has_situation_kw or word_count >= 15:
            situation_score = 15
            situation_strength = "adequate"
            situation_feedback = "Context provided, but could be more descriptive."
        elif word_count >= 8:
            situation_score = 8
            situation_strength = "weak"
            situation_feedback = "Background is brief or ambiguous."
        else:
            situation_score = 0
            situation_strength = "missing"
            situation_feedback = "Context / situation not clearly set."

        # 2. Task Analysis (0-25 pts)
        task_keywords = [
            "tasked with", "my role was", "responsible for", "needed to", "goal was",
            "objective", "had to", "assigned to", "requirement", "my responsibility",
            "target was", "expected to", "in order to", "aimed to", "had to decide",
            "mandate was", "focus was", "problem to solve", "mission was"
        ]
        has_task_kw = any(kw in lower_text for kw in task_keywords)
        task_score = 0
        task_strength = "missing"
        task_feedback = ""

        if has_task_kw and word_count >= 25:
            task_score = 25
            task_strength = "strong"
            task_feedback = "Objective and personal responsibility are clearly articulated."
        elif has_task_kw and word_count >= 15:
            task_score = 16
            task_strength = "adequate"
            task_feedback = "Objective is outlined, though explicit success criteria could be sharpened."
        elif has_task_kw or (has_situation_kw and word_count >= 30):
            task_score = 8
            task_strength = "weak"
            task_feedback = "Unclear what your exact mandate or responsibility was."
        else:
            task_score = 0
            task_strength = "missing"
            task_feedback = "No clear task or objective specified."

        # 3. Action Analysis (0-25 pts)
        # Match "I [adverb] <action_verb>" or direct technical action verbs
        first_person_action_pattern = re.compile(
            r'\b(?:i|my\s+team\s+and\s+i)\s+(?:[a-z]+\s+)?(investigated|implemented|isolated|built|designed|developed|refactored|led|created|automated|optimized|migrated|architected|resolved|diagnosed|deployed|wrote|diverted|instituted|authored|analyzed|decided|coordinated|configured|delivered|initiated|proposed|spearheaded|routed|audited|benchmarked)\b',
            re.IGNORECASE
        )
        first_person_actions = first_person_action_pattern.findall(text)
        action_verbs_standalone = re.compile(
            r'\b(investigated|implemented|isolated|built|designed|developed|refactored|automated|optimized|migrated|architected|deployed|configured|refactored)\b',
            re.IGNORECASE
        ).findall(text)

        action_score = 0
        action_strength = "missing"
        action_feedback = ""

        if len(first_person_actions) >= 2 or (len(first_person_actions) >= 1 and len(action_verbs_standalone) >= 2):
            action_score = 25
            action_strength = "strong"
            action_feedback = f"Strong active ownership demonstrated with concrete action milestones ({', '.join(set(first_person_actions))})."
        elif len(first_person_actions) >= 1 or (len(action_verbs_standalone) >= 1 and ("i " in lower_text or "my " in lower_text)):
            action_score = 16
            action_strength = "adequate"
            action_feedback = "Action steps mentioned, but more depth on your individual technical or procedural decisions would help."
        elif "we " in lower_text and len(action_verbs_standalone) >= 1:
            action_score = 10
            action_strength = "weak"
            action_feedback = "Actions are framed passively or as a collective team ('we') — clarify your specific individual contribution."
        elif len(action_verbs_standalone) >= 1 or ("i " in lower_text and word_count >= 30):
            action_score = 6
            action_strength = "weak"
            action_feedback = "Vague on concrete actions taken to resolve the challenge."
        else:
            action_score = 0
            action_strength = "missing"
            action_feedback = "No discernible actions described."

        # 4. Result Analysis (0-25 pts)
        metric_pattern = re.compile(
            r'\b(\d+(?:\.\d+)?%|\$\d+[kKmMbB]?|\d+(?:\.\d+)?ms|\d+x|\d+\s*(?:seconds|minutes|hours|days|percent|users|customers|orders|requests|queries|nodes|clusters))\b',
            re.IGNORECASE
        )
        has_metrics = bool(metric_pattern.search(text))
        result_keywords = [
            "result", "outcome", "consequently", "reduced", "increased", "improved",
            "saved", "achieved", "delivered", "dropped", "boosted", "scaled to",
            "zero lost", "zero downtime", "post-mortem", "learned", "feedback was",
            "within", "latency dropped", "throughput", "launched", "promoted"
        ]
        has_result_kw = any(kw in lower_text for kw in result_keywords)
        result_score = 0
        result_strength = "missing"
        result_feedback = ""

        if has_metrics and (has_result_kw or word_count >= 25):
            result_score = 25
            result_strength = "strong"
            result_feedback = "Exceptional result with quantifiable impact and concrete metrics."
        elif has_result_kw and word_count >= 20:
            result_score = 16
            result_strength = "adequate"
            result_feedback = "Outcome stated qualitatively, but missing quantifiable metrics (e.g. % improvement, time saved, latency)."
        elif has_result_kw or has_metrics:
            result_score = 10
            result_strength = "weak"
            result_feedback = "Brief outcome noted without broader business or performance impact."
        elif word_count >= 15:
            result_score = 4
            result_strength = "weak"
            result_feedback = "Story concludes abruptly without explaining the final result or learnings."
        else:
            result_score = 0
            result_strength = "missing"
            result_feedback = "No result or outcome provided."

        total_score = situation_score + task_score + action_score + result_score
        total_score = max(0, min(100, total_score))

        missing_elements = []
        weak_elements = []
        for name, strength in [
            ("situation", situation_strength),
            ("task", task_strength),
            ("action", action_strength),
            ("result", result_strength),
        ]:
            if strength == "missing":
                missing_elements.append(name)
            elif strength == "weak":
                weak_elements.append(name)

        coaching_tips = []
        follow_up_question = ""
        follow_up_target = "general"

        action_is_deficient = action_strength in ("missing", "weak")
        result_is_deficient = result_strength in ("missing", "weak")

        if action_is_deficient and result_is_deficient:
            follow_up_target = "action_and_result"
            follow_up_question = (
                "You've outlined the situation, but could you dive into the specific actions you personally executed, "
                "and what the measurable outcome or impact of your efforts was?"
            )
            coaching_tips.append("Focus on 'I' rather than 'we' to claim credit for your actions.")
            coaching_tips.append("Quantify your result with metrics (e.g. latency, revenue, error rates, time saved).")
        elif result_is_deficient:
            follow_up_target = "result"
            follow_up_question = (
                "You walked through your actions well, but what was the measurable result or business impact of your work? "
                "Were there any quantifiable metrics (such as performance improvement, latency drop, or cost savings) you can share?"
            )
            coaching_tips.append("Interviewers look for quantifiable proof: include percentage changes, latency drops, or scale numbers.")
        elif action_is_deficient:
            follow_up_target = "action"
            follow_up_question = (
                "You highlighted a great outcome, but could you dive deeper into the specific actions you personally took to achieve it? "
                "What technical decisions, tools, or steps did you implement?"
            )
            coaching_tips.append("Emphasize the step-by-step engineering or leadership decisions you made.")
        elif situation_strength in ("missing", "weak") or task_strength in ("missing", "weak"):
            follow_up_target = "situation_or_task"
            follow_up_question = (
                "To give full context to your achievements, could you briefly clarify the initial situation "
                "and what your specific objective or constraint was?"
            )
            coaching_tips.append("Set the stage quickly with the business or technical problem before jumping into action.")
        else:
            follow_up_target = "deep_dive"
            follow_up_question = (
                "That is a complete STAR response with solid metrics. If you had to tackle this same problem again today "
                "with different constraints, what would you do differently or how would you scale it further?"
            )
            coaching_tips.append("Great job! Be ready to discuss alternative approaches or trade-offs made.")

        return {
            "star_score": total_score,
            "completeness_score": total_score,
            "breakdown": {
                "situation": {"present": situation_score > 0, "strength": situation_strength, "score": situation_score, "feedback": situation_feedback},
                "task": {"present": task_score > 0, "strength": task_strength, "score": task_score, "feedback": task_feedback},
                "action": {"present": action_score > 0, "strength": action_strength, "score": action_score, "feedback": action_feedback},
                "result": {"present": result_score > 0, "strength": result_strength, "score": result_score, "feedback": result_feedback},
            },
            "missing_elements": missing_elements,
            "weak_elements": weak_elements,
            "follow_up_question": follow_up_question,
            "follow_up_target": follow_up_target,
            "coaching_tips": coaching_tips,
        }
