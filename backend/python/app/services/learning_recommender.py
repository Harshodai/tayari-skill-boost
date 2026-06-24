"""Learning Recommender service.
Recommends high-quality online courses, documentation, and certifications
to help users close their identified skill gaps.
"""
from typing import Dict, List, Any

# Curated catalog of standard learning resources for technical skills
RECOMMENDED_CATALOG: Dict[str, List[Dict[str, Any]]] = {
    "python": [
        {"title": "Python for Everybody Specialization", "url": "https://www.coursera.org/specializations/python", "provider": "Coursera (University of Michigan)", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Scientific Computing with Python", "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/", "provider": "freeCodeCamp", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "javascript": [
        {"title": "JavaScript Algorithms and Data Structures", "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/", "provider": "freeCodeCamp", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Modern JavaScript Tutorial", "url": "https://javascript.info/", "provider": "Javascript.info", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "typescript": [
        {"title": "TypeScript Handbook", "url": "https://www.typescriptlang.org/docs/handbook/intro.html", "provider": "TypeScript Official Docs", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Understanding TypeScript", "url": "https://www.udemy.com/course/understanding-typescript-2020-edition/", "provider": "Udemy", "difficulty": "intermediate", "cost_type": "paid"}
    ],
    "go": [
        {"title": "A Tour of Go", "url": "https://go.dev/tour/", "provider": "Go Official", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Gophercises - Coding Exercises for Budding Gophers", "url": "https://gophercises.com/", "provider": "Gophercises", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "react": [
        {"title": "Full Stack Open (React & Node.js)", "url": "https://fullstackopen.com/en/", "provider": "University of Helsinki", "difficulty": "intermediate", "cost_type": "free"},
        {"title": "React Documentation & Tutorials", "url": "https://react.dev/learn", "provider": "React Official", "difficulty": "beginner", "cost_type": "free"}
    ],
    "databases": [
        {"title": "SQLBolt - Learn SQL with simple interactive exercises", "url": "https://sqlbolt.com/", "provider": "SQLBolt", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Database Design Course", "url": "https://www.freecodecamp.org/news/database-design-course-learn-relational-databases/", "provider": "freeCodeCamp", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "postgresql": [
        {"title": "PostgreSQL Tutorial", "url": "https://www.postgresqltutorial.com/", "provider": "PostgreSQL Tutorial", "difficulty": "beginner", "cost_type": "free"}
    ],
    "redis": [
        {"title": "Redis University", "url": "https://university.redis.io/", "provider": "Redis", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "docker": [
        {"title": "Docker for Beginners", "url": "https://docker-curriculum.com/", "provider": "Docker Curriculum", "difficulty": "beginner", "cost_type": "free"}
    ],
    "kubernetes": [
        {"title": "Introduction to Kubernetes", "url": "https://www.edx.org/learn/kubernetes/the-linux-foundation-introduction-to-kubernetes", "provider": "edx (Linux Foundation)", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "devops": [
        {"title": "DevOps Roadmap & Guide", "url": "https://roadmap.sh/devops", "provider": "Roadmap.sh", "difficulty": "beginner", "cost_type": "free"}
    ],
    "aws": [
        {"title": "AWS Cloud Practitioner Essentials", "url": "https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/", "provider": "Amazon Web Services", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Ultimate AWS Certified Solutions Architect Associate", "url": "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/", "provider": "Udemy (Stephane Maarek)", "difficulty": "intermediate", "cost_type": "paid"}
    ],
    "machine learning": [
        {"title": "Machine Learning Specialization", "url": "https://www.coursera.org/specializations/machine-learning-introduction", "provider": "Coursera (DeepLearning.AI)", "difficulty": "beginner", "cost_type": "free"},
        {"title": "Applied Machine Learning", "url": "https://www.coursera.org/learn/applied-machine-learning-stats-models", "provider": "Coursera (Columbia)", "difficulty": "intermediate", "cost_type": "free"}
    ],
    "deep learning": [
        {"title": "Deep Learning Specialization", "url": "https://www.coursera.org/specializations/deep-learning", "provider": "Coursera (DeepLearning.AI)", "difficulty": "advanced", "cost_type": "free"}
    ],
    "ai": [
        {"title": "AI for Everyone", "url": "https://www.coursera.org/learn/ai-for-everyone", "provider": "Coursera (DeepLearning.AI)", "difficulty": "beginner", "cost_type": "free"}
    ],
    "agile": [
        {"title": "Agile Crash Course: Project Management with Agile", "url": "https://www.udemy.com/course/agile-crash-course/", "provider": "Udemy", "difficulty": "beginner", "cost_type": "paid"}
    ],
}

class LearningRecommender:
    @staticmethod
    def get_recommendations(missing_skills: List[str]) -> List[Dict[str, Any]]:
        """
        Retrieves learning path recommendations for the specified missing skills.
        """
        recommendations: List[Dict[str, Any]] = []
        seen_titles = set()

        for skill in missing_skills:
            skill_lower = skill.lower()
            # Direct match
            if skill_lower in RECOMMENDED_CATALOG:
                for resource in RECOMMENDED_CATALOG[skill_lower]:
                    if resource["title"] not in seen_titles:
                        recommendations.append({
                            "skill": skill,
                            **resource
                        })
                        seen_titles.add(resource["title"])
            else:
                # Fuzzy keyword containment match
                for catalog_skill, resources in RECOMMENDED_CATALOG.items():
                    if catalog_skill in skill_lower or skill_lower in catalog_skill:
                        for resource in resources:
                            if resource["title"] not in seen_titles:
                                recommendations.append({
                                    "skill": skill,
                                    **resource
                                })
                                seen_titles.add(resource["title"])

        # Default recommendations if no matches found
        if not recommendations:
            recommendations.append({
                "skill": "General Tech Skills",
                "title": "Developer Roadmaps & Guides",
                "url": "https://roadmap.sh",
                "provider": "Roadmap.sh",
                "difficulty": "beginner",
                "cost_type": "free"
            })

        return recommendations
