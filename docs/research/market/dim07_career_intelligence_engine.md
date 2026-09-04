# Dimension 7: Career Intelligence Engine

## Executive Summary

The Career Intelligence Engine transforms Tayari from a reactive job search tool into a **proactive career GPS**. It answers the questions every job seeker has: *"What skills am I missing?"*, *"What salary should I expect?"*, *"Which skills are trending?"*, and *"What should I learn next?"*

In 2026, top competitors like Qwyse, Jobscan, and Teal have begun offering market intelligence features, but none have integrated **real-time market data** with **personal skill gap analysis** and **learning path recommendations** in a single, local-first platform. Tayari can build this using **free data sources** (BLS O*NET, Stack Overflow Survey, Adzuna API) and **intelligent web scraping** (Crawl4AI/Playwright) — creating a moat that competitors can't easily replicate without significant data engineering investment.

The engine consists of four core modules:
1. **Skill Gap Analyzer** — Compare resume skills against market demand for target roles
2. **Salary Benchmarking** — Show salary ranges based on role, location, experience, and skills
3. **Trending Skills Radar** — Detect rising and declining skills from job posting data
4. **Learning Path Recommender** — Suggest courses, certifications, and projects to close skill gaps

**Implementation estimate:** 10-14 weeks (phased: data pipeline → skill analysis → salary → trends → learning paths).

---

## Data Source Landscape

### Free / Open Data Sources

| Source | Data Available | API Access | Rate Limits | Coverage | Best For |
|--------|---------------|------------|-------------|----------|----------|
| **BLS O*NET** | Occupational profiles, skills, knowledge, abilities, wages, job outlook | ✅ Free REST API | None documented | US only | Skill taxonomy, job descriptions, salary benchmarks |
| **Stack Overflow Survey** | Salary by role, technology, experience, country | ✅ Free CSV download | N/A | Global (developer-focused) | Tech salary benchmarks, trending technologies |
| **Adzuna API** | Job listings, salary estimates, company data | ✅ Free tier (1,000 calls/day) | 1,000/day | 16 countries (US, UK, India, etc.) | Job volume data, salary ranges, job posting scraping |
| **Jooble API** | Job listings aggregation | ✅ Free (requires attribution) | Fair use | Global | Job volume by role/location |
| **RemoteOK API** | Remote job listings, salary data | ✅ Free, no auth required | Fair use | Global remote | Remote work trends, salary data |
| **GitHub Jobs API** | Job listings (deprecated, alternatives exist) | ❌ Deprecated | N/A | N/A | Replaced by other sources |
| **Levels.fyi** | Tech salary data by company/level | ⚠️ No official API (can scrape) | N/A | Global tech | FAANG+ salary benchmarks |
| **Glassdoor** | Salary data, company reviews | ⚠️ Limited API (partner only) | N/A | Global | Company-specific salary data |
| **Indeed** | Job listings, salary data | ⚠️ Limited API (publisher program) | N/A | Global | Job volume, salary estimates |
| **ESCO (EU Skills)** | European skills taxonomy, occupations | ✅ Free API | Fair use | EU | European skill taxonomy |
| **India Govt APIs** | Employment data, NCS (National Career Service) | ✅ Free | N/A | India | India-specific job market data |

### Key Finding: BLS O*NET is the Hidden Gem

The Bureau of Labor Statistics O*NET database is the most comprehensive, free, structured occupational database in the world. It includes:
- **1,000+ occupations** with detailed descriptions
- **Skills, knowledge, abilities** for each occupation (rated 0-100 by importance)
- **Wage data** by occupation and geographic area
- **Job outlook projections** (growth/decline)
- **Education requirements** and training pathways
- **Related occupations** and career ladders

**API Endpoint:** `https://services.onetcenter.org/ws/` (requires free registration for API key)

### Web Scraping Strategy for Market Data

For sources without APIs, controlled scraping is viable:

```python
# backend/python/app/services/market_scraper.py
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
import asyncio
from datetime import datetime, timedelta
import json

class MarketDataScraper:
    def __init__(self, db_pool):
        self.db_pool = db_pool
        self.crawler = AsyncWebCrawler(config=BrowserConfig(headless=True))
        
    async def scrape_job_postings(self, sources: list[str], roles: list[str]) -> list[dict]:
        """Scrape job postings from multiple sources for skill frequency analysis"""
        results = []
        
        for role in roles:
            for source in sources:
                try:
                    postings = await self._scrape_source(source, role)
                    results.extend(postings)
                    
                    # Rate limiting: 1-3 seconds between requests
                    await asyncio.sleep(1.5)
                    
                except Exception as e:
                    logger.warning(f"Failed to scrape {source} for {role}: {e}")
                    continue
        
        return results
    
    async def _scrape_source(self, source: str, role: str) -> list[dict]:
        """Scrape a specific job board for a role"""
        
        if source == 'linkedin_jobs':
            return await self._scrape_linkedin(role)
        elif source == 'indeed':
            return await self._scrape_indeed(role)
        elif source == 'glassdoor':
            return await self._scrape_glassdoor(role)
        elif source == 'levels_fyi':
            return await self._scrape_levels_fyi(role)
        
        return []
    
    async def _scrape_linkedin(self, role: str) -> list[dict]:
        """Scrape LinkedIn job postings (respect robots.txt, use polite delays)"""
        # LinkedIn job search URL
        search_url = f"https://www.linkedin.com/jobs/search?keywords={role.replace(' ', '%20')}&location=India&trk=public_jobs_jobs-search-bar_search-submit"
        
        run_config = CrawlerRunConfig(
            extraction_strategy=JsonCssExtractionStrategy({
                "base_selector": ".job-search-card",
                "fields": [
                    {"name": "title", "selector": "h3.base-search-card__title", "type": "text"},
                    {"name": "company", "selector": "h4.base-search-card__subtitle", "type": "text"},
                    {"name": "location", "selector": ".job-search-card__location", "type": "text"},
                    {"name": "salary", "selector": ".job-search-card__salary-info", "type": "text"},
                    {"name": "skills", "selector": ".job-search-card__skills", "type": "list"},
                    {"name": "posted_date", "selector": "time", "type": "attribute", "attribute": "datetime"},
                ]
            }),
            cache_mode=False,
        )
        
        result = await self.crawler.arun(url=search_url, config=run_config)
        
        if result.success:
            return json.loads(result.extracted_content)
        
        return []
    
    async def extract_skills_from_description(self, description: str) -> list[str]:
        """Extract skills from job description using LLM + skill taxonomy"""
        # First try regex matching against known skill taxonomy
        known_skills = await self._get_skill_taxonomy()
        found_skills = [skill for skill in known_skills if skill.lower() in description.lower()]
        
        # Use LLM for ambiguous skills and context
        if len(found_skills) < 5:
            prompt = f"""Extract all technical skills, tools, frameworks, and soft skills mentioned in this job description.
Return as a JSON array of strings.

Job Description:
{description[:4000]}"""
            
            response = await self._llm_extract(prompt)
            found_skills.extend(response)
        
        return list(set(found_skills))  # Deduplicate
    
    async def _get_skill_taxonomy(self) -> set[str]:
        """Load comprehensive skill taxonomy from O*NET + tech stack + manual additions"""
        # Cache this in Redis or database
        cache_key = "skill_taxonomy_v1"
        cached = await self._get_cache(cache_key)
        if cached:
            return set(cached)
        
        skills = set()
        
        # O*NET skills
        onet_skills = await self._fetch_onet_skills()
        skills.update(onet_skills)
        
        # Tech stack skills (programming languages, frameworks, tools)
        tech_skills = {
            'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c++', 'c#', 'ruby', 'php',
            'react', 'vue', 'angular', 'svelte', 'next.js', 'node.js', 'django', 'flask', 'fastapi',
            'spring', 'express', 'graphql', 'rest api', 'sql', 'postgresql', 'mysql', 'mongodb',
            'redis', 'elasticsearch', 'kafka', 'rabbitmq', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
            'terraform', 'jenkins', 'github actions', 'ci/cd', 'machine learning', 'deep learning',
            'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'data science', 'nlp',
            'computer vision', 'llm', 'prompt engineering', 'rag', 'vector databases', 'mcp',
            'react native', 'flutter', 'swift', 'kotlin', 'android', 'ios', 'firebase',
            'figma', 'sketch', 'adobe xd', 'ui/ux', 'user research', 'wireframing', 'prototyping',
            'agile', 'scrum', 'kanban', 'jira', 'confluence', 'product management', 'product owner',
            'data analysis', 'business intelligence', 'tableau', 'power bi', 'excel', 'etl',
            'cybersecurity', 'penetration testing', 'siem', 'soc', 'firewall', 'encryption',
            'devops', 'sre', 'site reliability', 'observability', 'prometheus', 'grafana',
            'blockchain', 'solidity', 'web3', 'smart contracts', 'ethereum', 'bitcoin',
            'salesforce', 'sap', 'oracle', 'crm', 'erp', 'net suite', 'hubspot',
            'seo', 'sem', 'google analytics', 'content marketing', 'social media marketing',
            'copywriting', 'technical writing', 'documentation', 'api documentation',
            'project management', 'pmp', 'prince2', 'risk management', 'stakeholder management',
            'communication', 'leadership', 'team management', 'mentoring', 'coaching',
            'problem solving', 'critical thinking', 'analytical thinking', 'data-driven',
            'english', 'hindi', 'mandarin', 'spanish', 'french', 'german', 'japanese',
        }
        skills.update(tech_skills)
        
        await self._set_cache(cache_key, list(skills), ttl=86400 * 7)  # Cache 7 days
        return skills
    
    async def _fetch_onet_skills(self) -> list[str]:
        """Fetch skills from O*NET API"""
        # O*NET API requires registration: https://services.onetcenter.org/
        # Example endpoint: https://services.onetcenter.org/ws/online/occupations/15-1252.00/skills
        
        url = "https://services.onetcenter.org/ws/online/skills"
        headers = {"Authorization": f"Basic {ONET_API_KEY}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return [skill['name'] for skill in data.get('skills', [])]
        
        return []
```

### Legal and Ethical Scraping Considerations

1. **Respect robots.txt** — Always check and obey robots.txt before scraping
2. **Rate limiting** — Minimum 1-3 seconds between requests per domain
3. **User-Agent identification** — Identify as TayariBot with contact info
4. **No personal data** — Only scrape job postings, not user profiles
5. **Caching** — Cache results to avoid re-scraping; respect cache headers
6. **Terms of Service** — Review ToS of each platform; some prohibit scraping (LinkedIn, Indeed)
7. **Fallback strategy** — For platforms that prohibit scraping, use official APIs or alternative sources

**Recommendation:** Focus on Adzuna API (free, official) and Jooble API (free, official) for structured job data. Use scraping only for public, non-protected pages with explicit rate limiting. For LinkedIn/Indeed, use their official APIs or partner programs if available.

---

## Skill Taxonomy & Gap Analysis Design

### Skill Taxonomy Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SKILL TAXONOMY v1.0                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1: Category                    Level 2: Skill Family     │
│  ┌──────────────────┐               ┌────────────────────┐     │
│  │ Programming       │               │ Python             │     │
│  │                   │──────┬───────│ JavaScript         │     │
│  │                   │      │       │ TypeScript         │     │
│  └──────────────────┘      │       │ Go                 │     │
│                            │       │ Rust               │     │
│  ┌──────────────────┐      │       └────────────────────┘     │
│  │ Web Frameworks    │──────┘       ┌────────────────────┐     │
│  │                   │               │ React              │     │
│  │                   │───────────────│ Vue.js             │     │
│  └──────────────────┘               │ Next.js            │     │
│                                     │ Angular            │     │
│  ┌──────────────────┐               └────────────────────┘     │
│  │ Databases         │               ┌────────────────────┐     │
│  │                   │───────────────│ PostgreSQL         │     │
│  │                   │               │ MongoDB            │     │
│  └──────────────────┘               │ Redis              │     │
│                                     └────────────────────┘     │
│  ┌──────────────────┐               ┌────────────────────┐       │
│  │ Cloud & DevOps  │───────────────│ AWS                │       │
│  │                   │               │ Docker             │       │
│  │                   │               │ Kubernetes         │       │
│  └──────────────────┘               │ CI/CD              │       │
│                                     └────────────────────┘       │
│  ┌──────────────────┐               ┌────────────────────┐       │
│  │ AI/ML           │───────────────│ Machine Learning   │       │
│  │                   │               │ Deep Learning      │       │
│  │                   │               │ LLM Engineering    │       │
│  └──────────────────┘               │ Prompt Engineering │       │
│                                     └────────────────────┘       │
│  ┌──────────────────┐               ┌────────────────────┐       │
│  │ Soft Skills       │───────────────│ Communication      │       │
│  │                   │               │ Leadership         │       │
│  │                   │               │ Problem Solving    │       │
│  └──────────────────┘               │ Stakeholder Mgmt   │       │
│                                     └────────────────────┘       │
│  ┌──────────────────┐               ┌────────────────────┐       │
│  │ Languages         │───────────────│ English            │       │
│  │                   │               │ Hindi              │       │
│  │                   │               │ Mandarin           │       │
│  └──────────────────┘               └────────────────────┘       │
│                                                                 │
│  Sources: O*NET + ESCO + Stack Overflow + Manual Tech Stack     │
│  Total Skills: ~2,500 (technical + soft skills + languages)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Skill Gap Analysis Algorithm

```python
# backend/python/app/services/skill_gap_analyzer.py
from dataclasses import dataclass
from typing import list, dict
import numpy as np
from collections import defaultdict

@dataclass
class SkillGapResult:
    skill_name: str
    user_level: float  # 0-100, estimated from resume
    market_demand_level: float  # 0-100, from job posting analysis
    gap_score: float  # negative = gap, positive = strength
    importance_weight: float  # 0-1, how critical for target role
    learning_hours_estimate: int  # estimated hours to learn
    learning_resources: list[dict]  # suggested courses, docs, videos

@dataclass
class RoleFitAnalysis:
    role_title: str
    overall_match_score: float  # 0-100
    skill_gaps: list[SkillGapResult]
    skill_strengths: list[SkillGapResult]
    missing_critical_skills: list[str]
    recommended_priority: list[str]  # ordered learning priorities
    market_salary_range: tuple[float, float]  # min, max
    demand_trend: str  # "rising", "stable", "declining"
    competition_level: str  # "low", "medium", "high"

class SkillGapAnalyzer:
    def __init__(self, db_pool, market_data_service, llm_service):
        self.db = db_pool
        self.market = market_data_service
        self.llm = llm_service
        self.skill_taxonomy = self._load_taxonomy()
    
    async def analyze_skill_gap(
        self, 
        user_id: int, 
        target_role: str,
        target_location: str = "India",
        experience_years: int = None,
    ) -> RoleFitAnalysis:
        """Analyze skill gap between user's resume and market demand for target role"""
        
        # 1. Extract user skills from resume knowledge graph
        user_skills = await self._extract_user_skills(user_id)
        
        # 2. Get market demand skills for target role
        market_skills = await self.market.get_role_skill_demand(
            role=target_role,
            location=target_location,
        )
        
        # 3. Calculate gaps for each skill
        skill_gaps = []
        skill_strengths = []
        
        for skill_name, market_data in market_skills.items():
            user_level = user_skills.get(skill_name, 0)
            market_level = market_data['importance']  # 0-100
            frequency = market_data['frequency']  # % of job postings mentioning this skill
            
            gap_score = user_level - market_level
            importance_weight = self._calculate_importance(market_level, frequency)
            
            skill_result = SkillGapResult(
                skill_name=skill_name,
                user_level=user_level,
                market_demand_level=market_level,
                gap_score=gap_score,
                importance_weight=importance_weight,
                learning_hours_estimate=self._estimate_learning_hours(skill_name, gap_score),
                learning_resources=await self._find_learning_resources(skill_name),
            )
            
            if gap_score < -20:  # Significant gap
                skill_gaps.append(skill_result)
            elif gap_score > 20:  # Significant strength
                skill_strengths.append(skill_result)
        
        # 4. Sort by priority (importance × gap severity)
        skill_gaps.sort(key=lambda x: x.importance_weight * abs(x.gap_score), reverse=True)
        skill_strengths.sort(key=lambda x: x.importance_weight * x.gap_score, reverse=True)
        
        # 5. Identify missing critical skills (importance > 80, user level = 0)
        missing_critical = [
            gap.skill_name for gap in skill_gaps 
            if gap.importance_weight > 0.8 and gap.user_level == 0
        ]
        
        # 6. Calculate overall match score
        overall_match = self._calculate_match_score(user_skills, market_skills)
        
        # 7. Get market data
        salary_range = await self.market.get_salary_range(
            role=target_role,
            location=target_location,
            experience_years=experience_years,
        )
        demand_trend = await self.market.get_demand_trend(target_role)
        competition = await self.market.get_competition_level(target_role, target_location)
        
        return RoleFitAnalysis(
            role_title=target_role,
            overall_match_score=overall_match,
            skill_gaps=skill_gaps[:15],  # Top 15 gaps
            skill_strengths=skill_strengths[:10],  # Top 10 strengths
            missing_critical_skills=missing_critical,
            recommended_priority=[gap.skill_name for gap in skill_gaps[:5]],
            market_salary_range=salary_range,
            demand_trend=demand_trend,
            competition_level=competition,
        )
    
    def _calculate_importance(self, market_level: float, frequency: float) -> float:
        """Calculate importance weight based on how critical and common a skill is"""
        # Skills that are both important AND frequently mentioned are highest priority
        return (market_level / 100) * 0.6 + (frequency / 100) * 0.4
    
    def _calculate_match_score(self, user_skills: dict, market_skills: dict) -> float:
        """Calculate overall match score (0-100)"""
        if not market_skills:
            return 0
        
        total_weight = 0
        weighted_match = 0
        
        for skill_name, market_data in market_skills.items():
            importance = market_data['importance'] / 100
            user_level = user_skills.get(skill_name, 0) / 100
            market_level = market_data['importance'] / 100
            
            # Match is how close user level is to market level (not just having it)
            # If market wants 80 and user has 90, that's a good match
            # If market wants 80 and user has 20, that's a poor match
            match = 1 - abs(user_level - market_level)
            
            total_weight += importance
            weighted_match += match * importance
        
        return (weighted_match / total_weight * 100) if total_weight > 0 else 0
    
    def _estimate_learning_hours(self, skill_name: str, gap_score: float) -> int:
        """Estimate hours to learn a skill based on gap severity and skill type"""
        base_hours = {
            'programming_language': 80,
            'framework': 60,
            'tool': 40,
            'soft_skill': 100,
            'language': 200,
            'certification': 40,
        }
        
        # Determine skill category
        category = self._categorize_skill(skill_name)
        base = base_hours.get(category, 60)
        
        # Scale by gap severity (0-100)
        gap_magnitude = abs(gap_score) / 100
        return int(base * gap_magnitude)
    
    async def _find_learning_resources(self, skill_name: str) -> list[dict]:
        """Find free learning resources for a skill"""
        # This would integrate with learning platform APIs or a curated database
        # For MVP, use LLM to generate recommendations
        
        prompt = f"""Suggest 3 free learning resources for {skill_name}.
Include: 1 YouTube tutorial/playlist, 1 official documentation link, 1 free course.
Return as JSON array with fields: title, type, url, estimated_hours, difficulty_level."""
        
        response = await self.llm.generate(prompt)
        return json.loads(response)
    
    async def _extract_user_skills(self, user_id: int) -> dict[str, float]:
        """Extract and estimate user skill levels from resume knowledge graph"""
        # Query resume knowledge graph
        kg = await self.db.fetchrow(
            """SELECT skills, projects, experience_summary 
               FROM resume_knowledge_graphs 
               WHERE user_id = $1 
               ORDER BY created_at DESC 
               LIMIT 1""",
            user_id
        )
        
        if not kg:
            return {}
        
        skills = {}
        
        # Extract from skills list (with proficiency levels if available)
        for skill in kg['skills'] or []:
            skill_name = skill['name'].lower()
            proficiency = skill.get('proficiency', 'intermediate')
            level = {'beginner': 30, 'intermediate': 60, 'advanced': 85, 'expert': 95}.get(proficiency, 50)
            skills[skill_name] = level
        
        # Extract from projects (skills mentioned in projects get a boost)
        for project in kg['projects'] or []:
            for tech in project.get('technologies', []):
                tech_name = tech.lower()
                if tech_name in skills:
                    skills[tech_name] = min(skills[tech_name] + 10, 100)
                else:
                    skills[tech_name] = 40  # Assumed basic familiarity
        
        # Extract from experience (years of experience = higher skill level)
        for exp in kg['experience_summary'] or []:
            for skill in exp.get('skills_used', []):
                skill_name = skill.lower()
                years = exp.get('duration_years', 0)
                level = min(30 + years * 15, 100)  # 30 base + 15 per year, max 100
                if skill_name in skills:
                    skills[skill_name] = max(skills[skill_name], level)
                else:
                    skills[skill_name] = level
        
        return skills
```

### Skill Gap Visualization

```typescript
// src/components/SkillGapRadar.tsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface SkillGapData {
  skill: string;
  userLevel: number;
  marketDemand: number;
  fullMark: number;
}

export function SkillGapRadar({ data }: { data: SkillGapData[] }) {
  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          <Radar
            name="Your Skills"
            dataKey="userLevel"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
          />
          <Radar
            name="Market Demand"
            dataKey="marketDemand"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.3}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Example usage with top 8 skills for a target role
const skillData = [
  { skill: 'Python', userLevel: 85, marketDemand: 90, fullMark: 100 },
  { skill: 'React', userLevel: 70, marketDemand: 80, fullMark: 100 },
  { skill: 'AWS', userLevel: 40, marketDemand: 75, fullMark: 100 },
  { skill: 'SQL', userLevel: 60, marketDemand: 70, fullMark: 100 },
  { skill: 'Docker', userLevel: 30, marketDemand: 65, fullMark: 100 },
  { skill: 'Kubernetes', userLevel: 10, marketDemand: 50, fullMark: 100 },
  { skill: 'Machine Learning', userLevel: 45, marketDemand: 60, fullMark: 100 },
  { skill: 'Communication', userLevel: 80, marketDemand: 85, fullMark: 100 },
];
```

---

## Salary Benchmarking Architecture

### Data Sources for Salary Data

| Source | Coverage | Data Quality | Integration Method | Free? |
|--------|----------|-------------|-------------------|-------|
| **Stack Overflow Survey** | Global developers | High (self-reported) | CSV download | ✅ |
| **BLS O*NET** | US occupations | High (official) | REST API | ✅ |
| **Adzuna API** | 16 countries | Medium (estimated) | REST API | ✅ (limited) |
| **Levels.fyi** | Tech companies | High (verified) | Scraping | ⚠️ |
| **Glassdoor** | Global | Medium (estimated) | Limited API | ⚠️ |
| **Indeed** | Global | Medium (estimated) | Limited API | ⚠️ |
| **PayScale** | Global | Medium | No API | ❌ |
| **Salary.com** | US | Medium | No API | ❌ |

### Salary Normalization Algorithm

```python
class SalaryBenchmarkingService:
    def __init__(self, market_data_service, exchange_rate_service):
        self.market = market_data_service
        self.exchange = exchange_rate_service
    
    async def get_salary_range(
        self,
        role: str,
        location: str,
        experience_years: int = 0,
        skills: list[str] = None,
        company_size: str = None,  # startup, mid, enterprise
    ) -> dict:
        """Get salary benchmark for a role in a specific location"""
        
        # 1. Collect raw data from multiple sources
        sources = await self._collect_salary_data(role, location)
        
        # 2. Normalize all salaries to common currency (USD or local)
        normalized = []
        for source in sources:
            for data_point in source['salaries']:
                normalized_salary = self._normalize_salary(
                    amount=data_point['amount'],
                    currency=data_point['currency'],
                    period=data_point['period'],  # hourly, monthly, annual
                    location=data_point['location'],
                    source_type=source['type'],  # official, self-reported, estimated
                )
                normalized.append(normalized_salary)
        
        # 3. Apply experience multiplier
        experience_multiplier = self._experience_multiplier(experience_years)
        
        # 4. Apply skill premium
        skill_premium = self._skill_premium(skills or [], role)
        
        # 5. Apply company size adjustment
        company_multiplier = self._company_size_multiplier(company_size)
        
        # 6. Calculate adjusted range
        adjusted_salaries = [
            s * experience_multiplier * skill_premium * company_multiplier
            for s in normalized
        ]
        
        # 7. Calculate statistics
        if adjusted_salaries:
            return {
                'role': role,
                'location': location,
                'experience_years': experience_years,
                'currency': 'USD',  # or local currency
                'period': 'annual',
                'percentiles': {
                    'p10': np.percentile(adjusted_salaries, 10),
                    'p25': np.percentile(adjusted_salaries, 25),
                    'p50': np.percentile(adjusted_salaries, 50),  # median
                    'p75': np.percentile(adjusted_salaries, 75),
                    'p90': np.percentile(adjusted_salaries, 90),
                },
                'average': np.mean(adjusted_salaries),
                'sample_size': len(adjusted_salaries),
                'data_sources': [s['name'] for s in sources],
                'confidence': 'high' if len(adjusted_salaries) > 50 else 'medium' if len(adjusted_salaries) > 20 else 'low',
            }
        
        return {'error': 'Insufficient data for this role/location combination'}
    
    def _experience_multiplier(self, years: int) -> float:
        """Salary multiplier based on years of experience"""
        # Industry-standard experience multipliers
        multipliers = {
            0: 0.7,    # Entry level
            1: 0.8,
            2: 0.9,
            3: 1.0,    # Standard (3-5 years = baseline)
            4: 1.05,
            5: 1.1,
            6: 1.15,
            7: 1.2,
            8: 1.25,
            9: 1.3,
            10: 1.35,  # Senior
        }
        
        # For years > 10, diminishing returns
        if years > 10:
            return 1.35 + (years - 10) * 0.02  # +2% per year after 10
        
        return multipliers.get(years, 1.0)
    
    def _skill_premium(self, skills: list[str], role: str) -> float:
        """Calculate salary premium for in-demand skills"""
        # High-demand skills that command premium
        premium_skills = {
            'machine learning': 0.15,
            'ai': 0.15,
            'llm': 0.20,
            'blockchain': 0.10,
            'cybersecurity': 0.12,
            'kubernetes': 0.08,
            'aws': 0.05,
            'golang': 0.08,
            'rust': 0.10,
            'data science': 0.12,
        }
        
        total_premium = 1.0
        for skill in skills:
            skill_lower = skill.lower()
            if skill_lower in premium_skills:
                total_premium += premium_skills[skill_lower]
        
        # Cap at 50% premium
        return min(total_premium, 1.5)
    
    def _company_size_multiplier(self, company_size: str) -> float:
        """Adjust salary based on company size"""
        multipliers = {
            'startup': 0.85,      # Lower base but equity
            'small': 0.90,        # < 50 employees
            'mid': 1.0,           # 50-500 employees (baseline)
            'enterprise': 1.15,   # > 500 employees
            'faang': 1.30,        # Top tech companies
        }
        return multipliers.get(company_size, 1.0)
    
    async def estimate_user_market_value(
        self,
        user_id: int,
        target_role: str,
        target_location: str,
    ) -> dict:
        """Estimate a user's market value based on their profile + skills"""
        
        # Get user profile
        profile = await self._get_user_profile(user_id)
        
        # Get base salary for role/location
        base = await self.get_salary_range(
            role=target_role,
            location=target_location,
            experience_years=profile.get('experience_years', 0),
        )
        
        # Get skill gap analysis
        gap_analysis = await self.skill_gap_analyzer.analyze_skill_gap(
            user_id=user_id,
            target_role=target_role,
            target_location=target_location,
        )
        
        # Adjust base salary based on skill gaps and strengths
        skill_adjustment = 0
        for strength in gap_analysis.skill_strengths:
            skill_adjustment += strength.gap_score * 0.001  # Small positive boost
        
        for gap in gap_analysis.skill_gaps:
            skill_adjustment += gap.gap_score * 0.002  # Larger negative penalty
        
        estimated_salary = base['percentiles']['p50'] * (1 + skill_adjustment)
        
        return {
            'estimated_salary': estimated_salary,
            'salary_range': base,
            'skill_adjustment': skill_adjustment,
            'gap_analysis': gap_analysis,
            'negotiation_tips': await self._generate_negotiation_tips(gap_analysis, base),
        }
```

### Salary Visualization Component

```typescript
// src/components/SalaryBenchmark.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

interface SalaryData {
  percentile: string;
  salary: number;
  userPosition?: number;
}

export function SalaryBenchmark({ data, userSalary, currency }: { 
  data: SalaryData[]; 
  userSalary?: number;
  currency: string;
}) {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v) => `${currency}${v/1000}k`} />
          <YAxis dataKey="percentile" type="category" width={80} />
          <Tooltip formatter={(v: number) => `${currency}${v.toLocaleString()}`} />
          <Bar dataKey="salary" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          {userSalary && (
            <ReferenceLine 
              x={userSalary} 
              stroke="#ef4444" 
              strokeDasharray="3 3"
              label={{ value: 'Your Estimate', position: 'top', fill: '#ef4444' }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">P25 (Lower)</p>
          <p className="text-lg font-bold text-blue-600">{currency}{data.find(d => d.percentile === 'P25')?.salary.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-blue-100 rounded-lg">
          <p className="text-sm text-gray-600">P50 (Median)</p>
          <p className="text-lg font-bold text-blue-700">{currency}{data.find(d => d.percentile === 'P50')?.salary.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">P75 (Upper)</p>
          <p className="text-lg font-bold text-blue-600">{currency}{data.find(d => d.percentile === 'P75')?.salary.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## Trending Skills & Demand Forecasting

### Skill Trend Detection Algorithm

```python
class SkillTrendDetector:
    def __init__(self, db_pool, market_scraper):
        self.db = db_pool
        self.scraper = market_scraper
    
    async def detect_trending_skills(
        self, 
        role: str = None,
        location: str = 'India',
        lookback_months: int = 6,
    ) -> list[dict]:
        """Detect trending skills from job posting data over time"""
        
        # Get historical skill frequency data
        historical = await self._get_historical_skill_frequency(
            role=role,
            location=location,
            months=lookback_months,
        )
        
        trends = []
        for skill, frequency_data in historical.items():
            if len(frequency_data) < 3:  # Need at least 3 data points
                continue
            
            # Calculate trend using linear regression on monthly frequencies
            months = list(range(len(frequency_data)))
            frequencies = [d['frequency'] for d in frequency_data]
            
            slope, intercept, r_value, p_value, std_err = scipy.stats.linregress(months, frequencies)
            
            # Determine trend category
            if slope > 0.02 and p_value < 0.05:  # Significant increase (>2% per month)
                trend = 'rising'
                confidence = 'high' if r_value > 0.7 else 'medium'
            elif slope < -0.02 and p_value < 0.05:  # Significant decrease
                trend = 'declining'
                confidence = 'high' if r_value > 0.7 else 'medium'
            elif abs(slope) < 0.01:  # Stable
                trend = 'stable'
                confidence = 'high'
            else:  # Inconclusive
                trend = 'unclear'
                confidence = 'low'
            
            trends.append({
                'skill': skill,
                'trend': trend,
                'slope': slope,
                'r_squared': r_value ** 2,
                'p_value': p_value,
                'confidence': confidence,
                'current_frequency': frequencies[-1],
                'previous_frequency': frequencies[0],
                'percent_change': ((frequencies[-1] - frequencies[0]) / frequencies[0] * 100) if frequencies[0] > 0 else 0,
                'sample_size': sum(d['job_count'] for d in frequency_data),
            })
        
        # Sort by significance (rising first, then by percent change)
        trends.sort(key=lambda x: (
            0 if x['trend'] == 'rising' else 1 if x['trend'] == 'stable' else 2,
            abs(x['percent_change'])
        ), reverse=True)
        
        return trends
    
    async def detect_emerging_skills(self, role: str = None, location: str = 'India') -> list[dict]:
        """Detect newly emerging skills that weren't common 6 months ago but are now"""
        
        # Compare current month vs 6 months ago
        current_skills = await self._get_skill_frequency(role, location, months_ago=0)
        old_skills = await self._get_skill_frequency(role, location, months_ago=6)
        
        emerging = []
        for skill, current_freq in current_skills.items():
            old_freq = old_skills.get(skill, 0)
            
            # Emerging: was <5% 6 months ago, now >15%
            if old_freq < 0.05 and current_freq > 0.15:
                emerging.append({
                    'skill': skill,
                    'old_frequency': old_freq,
                    'current_frequency': current_freq,
                    'growth_multiplier': current_freq / old_freq if old_freq > 0 else float('inf'),
                    'category': 'emerging',  # newly important
                    'recommendation': 'High priority to learn — rapid adoption in job market',
                })
            
            # Hot: was <15%, now >30%
            elif old_freq < 0.15 and current_freq > 0.30:
                emerging.append({
                    'skill': skill,
                    'old_frequency': old_freq,
                    'current_frequency': current_freq,
                    'growth_multiplier': current_freq / old_freq if old_freq > 0 else float('inf'),
                    'category': 'hot',  # mainstream adoption
                    'recommendation': 'Must-have skill — dominant in current job market',
                })
        
        return sorted(emerging, key=lambda x: x['current_frequency'], reverse=True)
    
    async def predict_demand(self, role: str, location: str, months_ahead: int = 3) -> dict:
        """Predict future demand for a role based on trend extrapolation"""
        
        # Get historical job posting volume
        historical_volume = await self._get_historical_job_volume(role, location, months=12)
        
        if len(historical_volume) < 6:
            return {'prediction': 'insufficient_data', 'confidence': 'low'}
        
        # Simple linear extrapolation
        months = list(range(len(historical_volume)))
        volumes = [d['volume'] for d in historical_volume]
        
        slope, intercept, r_value, p_value, std_err = scipy.stats.linregress(months, volumes)
        
        # Predict next N months
        future_months = list(range(len(historical_volume), len(historical_volume) + months_ahead))
        predicted_volumes = [slope * m + intercept for m in future_months]
        
        # Seasonal adjustment (Q1 surge, Q4 slowdown)
        seasonal_adjustments = {1: 1.1, 2: 1.05, 3: 1.0, 4: 0.95, 5: 1.0, 6: 1.05, 
                               7: 0.95, 8: 1.0, 9: 1.1, 10: 1.05, 11: 0.9, 12: 0.85}
        
        current_month = datetime.now().month
        for i, pred in enumerate(predicted_volumes):
            month = (current_month + i) % 12 or 12
            predicted_volumes[i] *= seasonal_adjustments.get(month, 1.0)
        
        return {
            'role': role,
            'location': location,
            'predicted_volume': predicted_volumes[0],  # Next month
            'trend': 'rising' if slope > 0 else 'declining' if slope < 0 else 'stable',
            'trend_strength': abs(slope) / np.mean(volumes) * 100,  # % change per month
            'confidence': 'high' if r_value > 0.7 else 'medium' if r_value > 0.5 else 'low',
            'seasonal_context': self._get_seasonal_context(current_month),
            'recommendation': 'Apply now — demand is high' if slope > 0 and predicted_volumes[0] > np.mean(volumes) else 'Steady market',
        }
    
    def _get_seasonal_context(self, month: int) -> str:
        """Provide context about seasonal hiring patterns"""
        contexts = {
            1: 'January: New year hiring surge — highest volume month',
            2: 'February: Strong hiring continues post-budget',
            3: 'March: Q1 close — moderate activity',
            4: 'April: Q2 start — steady hiring',
            5: 'May: Pre-summer slowdown begins',
            6: 'June: Mid-year lull — fewer postings',
            7: 'July: Summer slowdown — lowest volume',
            8: 'August: Back-to-school hiring begins',
            9: 'September: Q3 surge — strong hiring',
            10: 'October: Pre-holiday push — good volume',
            11: 'November: Holiday slowdown begins',
            12: 'December: Year-end freeze — lowest volume',
        }
        return contexts.get(month, 'Steady market conditions')
```

### Trending Skills Visualization

```typescript
// src/components/TrendingSkills.tsx
interface TrendingSkill {
  skill: string;
  trend: 'rising' | 'stable' | 'declining';
  percentChange: number;
  currentFrequency: number;
  category: 'emerging' | 'hot' | 'established' | 'declining';
}

export function TrendingSkills({ skills }: { skills: TrendingSkill[] }) {
  return (
    <div className="space-y-4">
      {skills.map((skill) => (
        <div key={skill.skill} className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className={`
              w-3 h-3 rounded-full
              ${skill.trend === 'rising' ? 'bg-green-500' : ''}
              ${skill.trend === 'stable' ? 'bg-blue-500' : ''}
              ${skill.trend === 'declining' ? 'bg-red-500' : ''}
            `} />
            <div>
              <p className="font-medium">{skill.skill}</p>
              <p className="text-sm text-gray-500">
                {skill.category === 'emerging' && '🔥 Emerging — learn now'}
                {skill.category === 'hot' && '⭐ Hot — must-have'}
                {skill.category === 'established' && '✓ Established — stable demand'}
                {skill.category === 'declining' && '⚠ Declining — consider pivoting'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`
              font-bold
              ${skill.percentChange > 0 ? 'text-green-600' : 'text-red-600'}
            `}>
              {skill.percentChange > 0 ? '+' : ''}{skill.percentChange.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">
              {skill.currentFrequency}% of jobs
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Learning Path Recommender

### Learning Path Generation Algorithm

```python
class LearningPathRecommender:
    def __init__(self, skill_gap_analyzer, market_data_service, course_database):
        self.gap_analyzer = skill_gap_analyzer
        self.market = market_data_service
        self.courses = course_database
    
    async def generate_learning_path(
        self,
        user_id: int,
        target_role: str,
        hours_per_week: int = 10,
        max_months: int = 6,
    ) -> dict:
        """Generate a personalized learning path to close skill gaps for target role"""
        
        # 1. Get skill gap analysis
        gap_analysis = await self.gap_analyzer.analyze_skill_gap(
            user_id=user_id,
            target_role=target_role,
        )
        
        # 2. Prioritize gaps (critical first, then by ROI)
        prioritized_gaps = self._prioritize_gaps(gap_analysis.skill_gaps)
        
        # 3. Build learning modules
        modules = []
        total_hours = 0
        
        for gap in prioritized_gaps:
            if total_hours >= hours_per_week * 4 * max_months:  # Max hours budget
                break
            
            # Find best learning resources for this skill
            resources = await self._find_optimal_resources(
                skill=gap.skill_name,
                current_level=gap.user_level,
                target_level=gap.market_demand_level,
                hours_available=gap.learning_hours_estimate,
            )
            
            module = {
                'skill': gap.skill_name,
                'current_level': gap.user_level,
                'target_level': gap.market_demand_level,
                'estimated_hours': gap.learning_hours_estimate,
                'resources': resources,
                'practice_projects': await self._suggest_practice_projects(gap.skill_name),
                'verification_method': self._suggest_verification(gap.skill_name),
            }
            
            modules.append(module)
            total_hours += gap.learning_hours_estimate
        
        # 4. Schedule modules over time
        schedule = self._create_schedule(modules, hours_per_week, max_months)
        
        # 5. Calculate expected impact
        expected_match = self._calculate_expected_match(
            gap_analysis, modules
        )
        
        return {
            'target_role': target_role,
            'current_match_score': gap_analysis.overall_match_score,
            'expected_match_score': expected_match,
            'total_hours': total_hours,
            'estimated_completion_weeks': total_hours / hours_per_week,
            'modules': modules,
            'schedule': schedule,
            'weekly_commitment': hours_per_week,
            'milestones': self._generate_milestones(modules),
        }
    
    async def _find_optimal_resources(self, skill: str, current_level: float, target_level: float, hours_available: int) -> list[dict]:
        """Find the best mix of free learning resources for a skill"""
        
        # Resource types and their effectiveness per hour
        resource_types = {
            'video_course': {'hours_ratio': 0.4, 'effectiveness': 0.7, 'cost': 0},
            'documentation': {'hours_ratio': 0.2, 'effectiveness': 0.8, 'cost': 0},
            'practice_project': {'hours_ratio': 0.3, 'effectiveness': 0.9, 'cost': 0},
            'community_practice': {'hours_ratio': 0.1, 'effectiveness': 0.6, 'cost': 0},
        }
        
        resources = []
        remaining_hours = hours_available
        
        for res_type, config in resource_types.items():
            hours = min(remaining_hours, int(hours_available * config['hours_ratio']))
            if hours <= 0:
                continue
            
            # Find specific resources of this type
            specific = await self._find_resource_of_type(skill, res_type, hours)
            if specific:
                resources.append(specific)
                remaining_hours -= hours
        
        return resources
    
    async def _find_resource_of_type(self, skill: str, res_type: str, hours: int) -> dict:
        """Find a specific free resource of a given type for a skill"""
        
        # Curated database of free resources (would be maintained in database)
        # For MVP, use LLM to generate recommendations
        
        prompts = {
            'video_course': f"Find a free YouTube playlist or course for learning {skill} from beginner to intermediate level. Include title, URL, and estimated hours.",
            'documentation': f"Find the official documentation or best free tutorial for {skill}. Include URL and why it's good.",
            'practice_project': f"Suggest 2 hands-on practice projects for learning {skill}. Include difficulty, estimated hours, and what skills they demonstrate.",
            'community_practice': f"Suggest a free online community or forum for practicing {skill} and getting feedback.",
        }
        
        response = await self.llm.generate(prompts.get(res_type, ''))
        return json.loads(response)
    
    def _create_schedule(self, modules: list, hours_per_week: int, max_months: int) -> list[dict]:
        """Create a weekly learning schedule"""
        schedule = []
        week = 1
        hours_this_week = 0
        current_module_idx = 0
        
        while week <= max_months * 4 and current_module_idx < len(modules):
            module = modules[current_module_idx]
            remaining_module_hours = module['estimated_hours'] - module.get('completed_hours', 0)
            
            hours_to_allocate = min(
                remaining_module_hours,
                hours_per_week - hours_this_week,
            )
            
            if hours_to_allocate > 0:
                schedule.append({
                    'week': week,
                    'skill': module['skill'],
                    'hours': hours_to_allocate,
                    'activities': module['resources'][:2],  # Top 2 resources for the week
                })
                
                module['completed_hours'] = module.get('completed_hours', 0) + hours_to_allocate
                hours_this_week += hours_to_allocate
            
            # Move to next module if current is complete
            if module.get('completed_hours', 0) >= module['estimated_hours']:
                current_module_idx += 1
            
            # Move to next week if full
            if hours_this_week >= hours_per_week:
                week += 1
                hours_this_week = 0
        
        return schedule
    
    def _generate_milestones(self, modules: list) -> list[dict]:
        """Generate milestone checkpoints for the learning path"""
        milestones = []
        cumulative_hours = 0
        
        for i, module in enumerate(modules):
            cumulative_hours += module['estimated_hours']
            milestones.append({
                'milestone_number': i + 1,
                'skill': module['skill'],
                'completion_hours': cumulative_hours,
                'verification': module['verification_method'],
                'reward': f"+{self._estimate_match_score_boost(module)}% match score",
            })
        
        return milestones
    
    def _estimate_match_score_boost(self, module: dict) -> float:
        """Estimate how much this module will improve match score"""
        gap = module['target_level'] - module['current_level']
        importance = 0.05  # Each critical skill contributes ~5% to match score
        return min(gap * importance, 15)  # Cap at 15% per skill
```

---

## Implementation Architecture

### Data Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA PIPELINE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ BLS O*NET API   │    │ Adzuna API      │    │ Web Scrapers    │        │
│  │ (daily sync)    │    │ (daily sync)    │    │ (Crawl4AI)      │        │
│  │                 │    │                 │    │                 │        │
│  │ • Occupations   │    │ • Job listings  │    │ • LinkedIn*     │        │
│  │ • Skills        │    │ • Salary data   │    │ • Indeed*       │        │
│  │ • Wages         │    │ • Company data  │    │ • Levels.fyi    │        │
│  │ • Outlook       │    │                 │    │ • Glassdoor*    │        │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘        │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  │                                          │
│                         ┌────────▼────────┐                                 │
│                         │ ETL Processor   │                                 │
│                         │ (Python/DuckDB)│                                 │
│                         │                 │                                 │
│                         │ • Deduplication │                                 │
│                         │ • Normalization │                                 │
│                         │ • Enrichment    │                                 │
│                         │ • Geocoding     │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│           ┌──────────────────────┼──────────────────────┐                   │
│           │                      │                      │                   │
│  ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐       │
│  │ RAW_DATA Tables │    │ Analytics Tables │    │ Cache (Redis)   │       │
│  │                 │    │                  │    │                 │       │
│  │ job_postings    │    │ skill_frequency  │    │ trending_skills │       │
│  │ salary_data     │    │ salary_by_role   │    │ role_match_cache│       │
│  │ skills_taxonomy │    │ demand_trends    │    │ user_gap_cache  │       │
│  │                 │    │                  │    │ (TTL: 1-24h)    │       │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘       │
│                                                                             │
│  Scheduled Jobs (Cron):                                                     │
│  • Daily: Scrape job postings, update skill frequency                      │
│  • Weekly: Update salary benchmarks, detect trending skills                  │
│  • Monthly: Full taxonomy refresh, demand forecasting                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Additions

```sql
-- Market data tables

-- Job postings scraped from various sources
CREATE TABLE job_postings_raw (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL, -- 'adzuna', 'linkedin', 'indeed', 'jooble', etc.
    external_id VARCHAR(255), -- ID from source
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    location VARCHAR(255),
    country VARCHAR(100),
    salary_min DECIMAL(12,2),
    salary_max DECIMAL(12,2),
    salary_currency VARCHAR(3),
    salary_period VARCHAR(20), -- 'hourly', 'monthly', 'annual'
    description TEXT,
    skills JSONB, -- extracted skills array
    experience_min_years INTEGER,
    experience_max_years INTEGER,
    job_type VARCHAR(50), -- 'full_time', 'contract', 'remote', 'hybrid'
    posted_date DATE,
    scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
    raw_data JSONB, -- full raw response
    url TEXT,
    UNIQUE(source, external_id)
);

CREATE INDEX idx_job_postings_role ON job_postings_raw(title);
CREATE INDEX idx_job_postings_location ON job_postings_raw(location, country);
CREATE INDEX idx_job_postings_scraped_at ON job_postings_raw(scraped_at);
CREATE INDEX idx_job_postings_skills ON job_postings_raw USING GIN(skills);

-- Skill frequency by role and time period
CREATE TABLE skill_frequency (
    id SERIAL PRIMARY KEY,
    role_category VARCHAR(100) NOT NULL, -- normalized role category
    location VARCHAR(100),
    country VARCHAR(100),
    skill VARCHAR(100) NOT NULL,
    frequency_percent DECIMAL(5,2) NOT NULL, -- % of job postings mentioning this skill
    job_count INTEGER NOT NULL, -- number of jobs in sample
    sample_period_start DATE NOT NULL,
    sample_period_end DATE NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(role_category, location, country, skill, sample_period_start, sample_period_end, source)
);

CREATE INDEX idx_skill_frequency_role ON skill_frequency(role_category, skill);
CREATE INDEX idx_skill_frequency_period ON skill_frequency(sample_period_start, sample_period_end);

-- Salary benchmarks by role, location, experience
CREATE TABLE salary_benchmarks (
    id SERIAL PRIMARY KEY,
    role VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    country VARCHAR(100),
    experience_min_years INTEGER,
    experience_max_years INTEGER,
    company_size VARCHAR(50), -- 'startup', 'small', 'mid', 'enterprise', 'faang'
    currency VARCHAR(3) NOT NULL,
    period VARCHAR(20) NOT NULL DEFAULT 'annual',
    p10 DECIMAL(12,2),
    p25 DECIMAL(12,2),
    p50 DECIMAL(12,2), -- median
    p75 DECIMAL(12,2),
    p90 DECIMAL(12,2),
    average DECIMAL(12,2),
    sample_size INTEGER,
    data_sources JSONB,
    confidence VARCHAR(20), -- 'high', 'medium', 'low'
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(role, location, country, experience_min_years, experience_max_years, company_size, currency, period)
);

CREATE INDEX idx_salary_benchmarks_role ON salary_benchmarks(role, location, country);

-- Skill taxonomy
CREATE TABLE skill_taxonomy (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    family VARCHAR(100),
    description TEXT,
    aliases JSONB, -- alternative names for this skill
    parent_skill_id INTEGER REFERENCES skill_taxonomy(id),
    is_technical BOOLEAN DEFAULT TRUE,
    is_soft_skill BOOLEAN DEFAULT FALSE,
    is_language BOOLEAN DEFAULT FALSE,
    source VARCHAR(50), -- 'onet', 'esco', 'stackoverflow', 'manual'
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_taxonomy_category ON skill_taxonomy(category);
CREATE INDEX idx_skill_taxonomy_aliases ON skill_taxonomy USING GIN(aliases);

-- Learning resources (curated)
CREATE TABLE learning_resources (
    id SERIAL PRIMARY KEY,
    skill_id INTEGER NOT NULL REFERENCES skill_taxonomy(id),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'video', 'documentation', 'course', 'book', 'project', 'community'
    url TEXT,
    provider VARCHAR(100), -- 'YouTube', 'freeCodeCamp', 'Coursera', 'Udemy', etc.
    cost_type VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'freemium', 'paid'
    estimated_hours INTEGER,
    difficulty_level VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'
    rating DECIMAL(3,2),
    review_count INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_resources_skill ON learning_resources(skill_id);
CREATE INDEX idx_learning_resources_type ON learning_resources(type, cost_type);

-- User skill gap analyses (cached)
CREATE TABLE user_skill_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_role VARCHAR(100) NOT NULL,
    target_location VARCHAR(100),
    overall_match_score DECIMAL(5,2),
    skill_gaps JSONB, -- array of gap objects
    skill_strengths JSONB, -- array of strength objects
    missing_critical_skills JSONB,
    recommended_priority JSONB,
    market_salary_min DECIMAL(12,2),
    market_salary_max DECIMAL(12,2),
    demand_trend VARCHAR(20),
    competition_level VARCHAR(20),
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE(user_id, target_role, target_location)
);

CREATE INDEX idx_user_skill_analyses_user ON user_skill_analyses(user_id);
CREATE INDEX idx_user_skill_analyses_expires ON user_skill_analyses(expires_at);
```

### API Endpoints

```python
# backend/python/app/api/career_intelligence.py
from fastapi import APIRouter, Depends
from app.services.career_intelligence import CareerIntelligenceService

router = APIRouter(prefix="/api/v1/career-intelligence")

@router.get("/skills-gap")
async def get_skill_gap(
    target_role: str,
    target_location: str = "India",
    user_id: int = Depends(get_current_user_id),
    service: CareerIntelligenceService = Depends(get_career_intelligence_service),
):
    """Analyze skill gap between user's resume and market demand for target role"""
    return await service.analyze_skill_gap(user_id, target_role, target_location)

@router.get("/salary-benchmark")
async def get_salary_benchmark(
    role: str,
    location: str,
    experience_years: int = 0,
    skills: list[str] = Query(default=[]),
    company_size: str = None,
    service: CareerIntelligenceService = Depends(get_career_intelligence_service),
):
    """Get salary benchmark for a role in a specific location"""
    return await service.get_salary_benchmark(role, location, experience_years, skills, company_size)

@router.get("/trending-skills")
async def get_trending_skills(
    role: str = None,
    location: str = "India",
    lookback_months: int = 6,
    service: CareerIntelligenceService = Depends(get_career_intelligence_service),
):
    """Get trending skills (rising, stable, declining) for a role/location"""
    return await service.get_trending_skills(role, location, lookback_months)

@router.get("/demand-forecast")
async def get_demand_forecast(
    role: str,
    location: str = "India",
    months_ahead: int = 3,
    service: CareerIntelligenceService = Depends(get_career_intelligence_service),
):
    """Predict future demand for a role"""
    return await service.predict_demand(role, location, months_ahead)

@router.get("/learning-path")
async def get_learning_path(
    target_role: str,
    hours_per_week: int = 10,
    max_months: int = 6,
    user_id: int = Depends(get_current_user_id),
    service: CareerIntelligenceService = Depends(get_career_intelligence_service),
):
    """Generate personalized learning path to close skill gaps"""
    return await service.generate_learning_path(user_id, target_role, hours_per_week, max_months)

@router.get("/market-value")
async def get_market_value(
    target_role: str,
    target_location: str = "India",
    user_id: int = Depends(get_current_user_id),
    service: CareerIntelligenceService = Depends(get_career_intelligence_service),
):
    """Estimate user's market value based on skills and experience"""
    return await service.estimate_user_market_value(user_id, target_role, target_location)
```

### Frontend Components

```typescript
// src/pages/CareerIntelligence.tsx
// Career Intelligence Dashboard — the strategic command center for job seekers

// Features:
// 1. Skill Gap Radar Chart (user vs market)
// 2. Salary Benchmark (percentile comparison)
// 3. Trending Skills (rising/declining)
// 4. Learning Path (week-by-week schedule)
// 5. Demand Forecast (apply now vs wait)
// 6. Market Value Estimator (what am I worth?)
// 7. Role Explorer (browse different roles, see match scores)

// Route: /career-intelligence
// Accessible from Dashboard and Profile pages
```

---

## Integration with Tayari Stack

| Tayari Feature | Integration Point | Data Flow |
|---------------|-------------------|-----------|
| **Resume Knowledge Graph** | Primary input for skill extraction | KG → skill gap analysis input |
| **Job Search** | Context for target role selection | Selected job → trigger skill gap analysis |
| **Profile** | Experience years, location, current role | Profile data → salary benchmarking parameters |
| **Interview Prep** | Learning path integration | Gap analysis → suggest interview prep focus areas |
| **Browser Extension** | Job detection → instant skill gap | Detected job → quick skill match score |
| **Dashboard** | Career intelligence cards | Summary widgets showing top gaps, trending skills, salary estimate |
| **Resume Optimizer** | Skill gap → resume improvement | Missing skills → suggest adding to resume |

### Cross-Feature User Journey

```
User Journey: "Am I ready for this role?"

1. User finds a job on Job Search page
2. Clicks "Analyze My Fit" → opens Career Intelligence overlay
3. System runs skill gap analysis using resume KG + job requirements
4. Shows radar chart: "Your skills vs Market demand for Senior Frontend Engineer"
5. Shows salary benchmark: "P50 for this role in Bangalore: ₹24-32 LPA"
6. Shows trending skills: "React is stable, but Next.js is rising (+15%)"
7. Shows learning path: "Close 3 gaps in 8 weeks with 10 hrs/week"
8. User clicks "Optimize Resume for This Role"
9. System suggests adding missing skills, quantifying achievements
10. User applies with optimized resume → higher callback probability
```

---

## Competitive Analysis

| Competitor | Skill Gap? | Salary Data? | Trending Skills? | Learning Paths? | Local Data? | Free Tier? |
|------------|-----------|-------------|-----------------|----------------|-------------|-----------|
| **Jobscan** | ✅ Basic (keyword match) | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Limited |
| **Teal** | ✅ Yes (match score) | ✅ Yes (limited) | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Qwyse** | ✅ Yes (career GPS) | ✅ Yes | ✅ Yes (limited) | ✅ Yes | ❌ No | ✅ Yes |
| **Rezi** | ✅ Yes (ATS score) | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **LinkedIn Premium** | ✅ Yes (skills assessment) | ✅ Yes (salary insights) | ✅ Yes (trending) | ✅ Yes (LinkedIn Learning) | ❌ No | ❌ No ($30/mo) |
| **Tayari (planned)** | ✅ **Deep** (resume KG + market) | ✅ **Free sources** | ✅ **Real-time scraping** | ✅ **Free resources** | ✅ **Ollama local** | ✅ **Free tier** |

**Tayari's Differentiation:**
1. **Only platform** that integrates resume knowledge graph with real-time market intelligence
2. **Only platform** with free, comprehensive salary benchmarking from multiple sources
3. **Only platform** that generates learning paths from skill gaps using free resources
4. **Only platform** with local-first option (Ollama) for privacy-conscious market analysis
5. **Only platform** that connects market intelligence directly to resume optimization and job application

---

## Implementation Roadmap

### Phase 1: Data Foundation (Weeks 1-3)
- **Tasks:**
  - Set up BLS O*NET API integration
  - Set up Adzuna API integration
  - Build skill taxonomy database (O*NET + tech stack + manual)
  - Build job posting scraper (Crawl4AI for Adzuna fallback)
  - Create database schema for market data tables
  - Implement daily ETL pipeline (cron job)
- **Deliverable:** Populated database with skill taxonomy, initial job posting data, salary benchmarks

### Phase 2: Skill Gap Analysis (Weeks 4-6)
- **Tasks:**
  - Build skill extraction from resume knowledge graph
  - Build skill frequency analysis from job postings
  - Implement skill gap scoring algorithm
  - Build API endpoints for skill gap analysis
  - Create React radar chart component for skill gaps
  - Add "Analyze My Fit" button to job search results
- **Deliverable:** Working skill gap analysis with visualization

### Phase 3: Salary & Trends (Weeks 7-9)
- **Tasks:**
  - Implement salary normalization algorithm
  - Build salary benchmark API and visualization
  - Implement skill trend detection (linear regression on time series)
  - Build trending skills dashboard component
  - Implement demand forecasting (simple extrapolation)
- **Deliverable:** Salary benchmarks and trending skills dashboard

### Phase 4: Learning Paths (Weeks 10-12)
- **Tasks:**
  - Build learning resource database (curated free resources)
  - Implement learning path generation algorithm
  - Build learning path UI (weekly schedule, milestones, progress tracking)
  - Integrate with resume optimizer ("Add this skill to your resume")
  - Add push notification reminders for learning streaks
- **Deliverable:** Personalized learning paths with weekly schedules

### Phase 5: Advanced Analytics (Weeks 13-14)
- **Tasks:**
  - Add market value estimator
  - Add role explorer (browse roles, see match scores)
  - Add demand forecasting alerts ("Apply now — demand is high")
  - Add cross-feature integration (job search → career intelligence → resume optimizer)
  - Performance optimization (caching, database indexes)
- **Deliverable:** Complete Career Intelligence Dashboard with all features

---

## Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **API rate limits (Adzuna)** | Medium | Medium | Cache aggressively; implement request queue; use multiple free sources |
| **Scraping blocked by job boards** | High | High | Respect robots.txt; use official APIs where possible; fallback to user-provided data |
| **Data quality issues** | Medium | High | Multi-source validation; confidence scoring; manual curation for critical data |
| **Skill taxonomy incompleteness** | Medium | Medium | Start with O*NET + top 500 tech skills; crowdsource additions from users |
| **Salary data inaccuracy** | Medium | Medium | Show confidence levels; use multiple sources; allow user corrections |
| **Cold start (no historical data)** | High | High | Seed with O*NET data; use Stack Overflow survey as baseline; gradual improvement |
| **User privacy concerns** | Low | Medium | Local processing option (Ollama); clear data usage policy; no selling of data |
| **Geographic bias (US-centric data)** | High | Medium | Prioritize India data sources; partner with Indian job boards; user-contributed data |

---

## Recommended Next Steps

### Immediate (Week 1)
1. **Register for BLS O*NET API key** — Free, instant approval
2. **Register for Adzuna API key** — Free, 1,000 calls/day
3. **Build skill taxonomy v1** — Combine O*NET + top 500 tech skills + soft skills
4. **Create database schema** — All market data tables

### Short-Term (Weeks 2-4)
5. **Implement daily data sync** — BLS O*NET + Adzuna ETL pipeline
6. **Build skill gap analyzer** — Core algorithm with resume KG integration
7. **Create skill gap visualization** — Radar chart component in React
8. **Add "Analyze My Fit" to job search** — Quick skill match overlay

### Medium-Term (Weeks 5-9)
9. **Implement salary benchmarking** — Multi-source normalization + visualization
10. **Build trending skills detector** — Time-series analysis on scraped data
11. **Create demand forecasting** — Simple extrapolation with seasonal adjustment
12. **Build Career Intelligence Dashboard page** — `/career-intelligence`

### Long-Term (Weeks 10-14)
13. **Build learning path generator** — Personalized week-by-week schedules
14. **Curate learning resources** — Free courses, docs, videos for top 200 skills
15. **Integrate with resume optimizer** — "Add missing skills to your resume"
16. **Add role explorer** — Browse all roles, see match scores, explore careers

---

## Verified Resources

- **BLS O*NET API:** https://services.onetcenter.org/ — Free occupational data API (requires registration)
- **O*NET Skills Taxonomy:** https://www.onetcenter.org/taxonomy.html — Comprehensive skills classification
- **Adzuna API:** https://developer.adzuna.com/ — Free job search API (1,000 calls/day)
- **Stack Overflow Survey:** https://survey.stackoverflow.co/ — Annual developer survey with salary data
- **ESCO (EU Skills):** https://esco.ec.europa.eu/en — European skills taxonomy
- **Crawl4AI:** https://github.com/unclecode/crawl4ai — LLM-ready web scraper
- **WEF Future of Jobs Report 2025:** https://reports.weforum.org/docs/WEF_Future_of_Jobs_Report_2025.pdf — Global skill trends
- **Randstad Salary Guide 2025:** https://www.randstad.com.hk/ — Regional salary benchmarks
