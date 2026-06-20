"""
Interview AI — resume-aware mock interview generator with STAR coaching.
"""
import re
import random
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_complete


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
    def generate(
        resume_text: str,
        job_title: str,
        company_name: Optional[str] = None,
        job_description: Optional[str] = None,
        interview_type: str = "behavioral",
    ) -> Dict[str, Any]:
        if interview_type == "behavioral":
            return InterviewPrepGenerator._behavioral(resume_text, job_title, company_name)
        elif interview_type == "technical":
            return InterviewPrepGenerator._technical(resume_text, job_title, job_description)
        elif interview_type == "system-design":
            return InterviewPrepGenerator._system_design(job_title, job_description)
        else:
            return InterviewPrepGenerator._behavioral(resume_text, job_title, company_name)

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
    def _behavioral(resume_text: str, job_title: str, company_name: Optional[str] = None) -> Dict[str, Any]:
        bullets = InterviewPrepGenerator._extract_bullets(resume_text)
        if not bullets:
            bullets = ["Led cross-functional team to deliver product feature", "Improved system performance through optimization"]

        questions = []
        for i, bullet in enumerate(bullets[:5]):
            prompt = f"""Given this resume bullet: "{bullet}"

Generate ONE behavioral interview question that probes this specific achievement. The question should be natural and specific.

Also provide a suggested STAR answer outline:
- Situation: 1 sentence context
- Task: 1 sentence goal
- Action: 2-3 sentences what you did
- Result: 1 sentence with metric

Return in this exact format:
QUESTION: [question text]
SITUATION: [situation]
TASK: [task]
ACTION: [action]
RESULT: [result]"""
            raw = llm_complete(prompt, max_tokens=400, temperature=0.7)

            q_match = re.search(r'QUESTION:\s*(.+?)(?=\nSITUATION:|$)', raw, re.DOTALL)
            s_match = re.search(r'SITUATION:\s*(.+?)(?=\nTASK:|$)', raw, re.DOTALL)
            t_match = re.search(r'TASK:\s*(.+?)(?=\nACTION:|$)', raw, re.DOTALL)
            a_match = re.search(r'ACTION:\s*(.+?)(?=\nRESULT:|$)', raw, re.DOTALL)
            r_match = re.search(r'RESULT:\s*(.+?)(?=\n|$)', raw, re.DOTALL)

            questions.append({
                "question": (q_match.group(1).strip() if q_match else f"Tell me about: {bullet[:80]}"),
                "category": "behavioral",
                "source_bullet": bullet,
                "star_suggested": {
                    "situation": (s_match.group(1).strip() if s_match else "Describe the context where this happened."),
                    "task": (t_match.group(1).strip() if t_match else "What was your goal or responsibility?"),
                    "action": (a_match.group(1).strip() if a_match else "What specific steps did you take?"),
                    "result": (r_match.group(1).strip() if r_match else "What was the outcome with metrics?"),
                },
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
    def _technical(resume_text: str, job_title: str, job_description: Optional[str] = None) -> Dict[str, Any]:
        skills = InterviewPrepGenerator._extract_skills(resume_text)
        if not skills:
            skills = ["general programming"]

        jd_context = f"\nJob Description:\n{job_description[:1000]}" if job_description else ""

        prompt = f"""Given the candidate's skills: {', '.join(skills)}
Job Title: {job_title}
{jd_context}

Generate 5 technical interview questions appropriate for this role. Each question should:
1. Be specific to one of the skills listed.
2. Be at an intermediate-to-advanced level.
3. Include a brief suggested answer or key points to cover.

Return in this format:
Q1: [question]
A1: [suggested answer/key points]
Q2: ..."""
        raw = llm_complete(prompt, max_tokens=800, temperature=0.7)

        questions = []
        q_matches = re.findall(r'Q\d+:\s*(.+?)(?=\nA\d+:|$)', raw, re.DOTALL)
        a_matches = re.findall(r'A\d+:\s*(.+?)(?=\nQ\d+:|$)', raw, re.DOTALL)

        for i in range(min(len(q_matches), len(a_matches), 5)):
            questions.append({
                "question": q_matches[i].strip().replace("\n", " "),
                "category": "technical",
                "skill": skills[i % len(skills)] if skills else "general",
                "suggested_answer": a_matches[i].strip().replace("\n", " "),
            })

        return {
            "questions": questions,
            "interview_type": "technical",
            "skills_tested": skills,
        }

    @staticmethod
    def _system_design(job_title: str, job_description: Optional[str] = None) -> Dict[str, Any]:
        jd_context = f"\nJob Description:\n{job_description[:1000]}" if job_description else ""

        prompt = f"""Job Title: {job_title}
{jd_context}

Generate 3 system design interview questions appropriate for this role. For each question, provide:
1. The problem statement
2. Key requirements (functional and non-functional)
3. Suggested high-level approach

Return in this format:
Q1: [question]
REQ1: [requirements]
APPROACH1: [approach]
Q2: ..."""
        raw = llm_complete(prompt, max_tokens=700, temperature=0.7)

        questions = []
        q_matches = re.findall(r'Q\d+:\s*(.+?)(?=\nREQ\d+:|$)', raw, re.DOTALL)
        req_matches = re.findall(r'REQ\d+:\s*(.+?)(?=\nAPPROACH\d+:|$)', raw, re.DOTALL)
        app_matches = re.findall(r'APPROACH\d+:\s*(.+?)(?=\nQ\d+:|$)', raw, re.DOTALL)

        for i in range(min(len(q_matches), len(req_matches), len(app_matches), 3)):
            questions.append({
                "question": q_matches[i].strip().replace("\n", " "),
                "category": "system-design",
                "requirements": req_matches[i].strip().replace("\n", " "),
                "suggested_approach": app_matches[i].strip().replace("\n", " "),
            })

        return {
            "questions": questions,
            "interview_type": "system-design",
        }
