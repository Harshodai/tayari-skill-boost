# Dimension 8: Predictive Funnel Analytics & A/B Testing

## Executive Summary

Predictive Funnel Analytics transforms Tayari from a passive tracking tool into an **intelligent optimization engine**. It answers: *"Which resume version gets more callbacks?"*, *"What's my probability of getting an interview for this role?"*, *"When should I apply?"*, and *"How can I improve my conversion rate?"*

In 2026, no job search platform offers **true predictive analytics** that connects resume quality → job fit → application timing → predicted outcomes. Teal offers basic tracking, Jobscan offers resume scoring, but no one closes the loop with **A/B testing resume variants** and **personalized optimization recommendations**. Tayari can build this using the data it already collects: resume versions, application history, job descriptions, and interview outcomes.

The system consists of four core modules:
1. **Resume Scoring Engine** — Multi-dimensional score (0-100) predicting callback likelihood
2. **Job Fit Prediction** — Resume ↔ job description matching with conversion probability
3. **A/B Testing with Bandits** — Multi-armed bandit testing of resume variants (A/B/C/D)
4. **Personalized Insights Engine** — Actionable recommendations based on user's historical data

**Key technical decision:** Start with **simple heuristics + Bayesian updating** (not complex ML). With limited early-user data, heuristics outperform ML models. Graduate to ML (XGBoost, logistic regression) as data volume grows past 1,000 applications.

**Implementation estimate:** 6-10 weeks (phased: scoring → fit prediction → bandit A/B → insights).

---

## Predictive Model Design

### Resume Scoring Engine (Heuristic v1, ML v2)

The resume scoring engine predicts the probability of getting a callback based on resume quality. Version 1 uses heuristics; Version 2 uses ML trained on application outcomes.

#### Heuristic Scoring (Version 1 — Immediate Implementation)

```python
class ResumeScoringEngine:
    """Heuristic-based resume scoring for immediate deployment (no ML training needed)"""
    
    def __init__(self, llm_service):
        self.llm = llm_service
    
    async def score_resume(self, resume_text: str, job_description: str = None) -> dict:
        """Score a resume across multiple dimensions (0-100 each)"""
        
        dimensions = {
            'ats_compatibility': self._score_ats_compatibility(resume_text),
            'content_quality': self._score_content_quality(resume_text),
            'role_relevance': await self._score_role_relevance(resume_text, job_description),
            'impact_quantification': self._score_impact_quantification(resume_text),
            'structure_formatting': self._score_structure(resume_text),
        }
        
        # Weighted overall score
        weights = {
            'ats_compatibility': 0.20,
            'content_quality': 0.25,
            'role_relevance': 0.30,  # Highest weight when job description provided
            'impact_quantification': 0.15,
            'structure_formatting': 0.10,
        }
        
        overall = sum(dimensions[k] * weights[k] for k in dimensions)
        
        return {
            'overall_score': round(overall, 1),
            'dimensions': dimensions,
            'breakdown': await self._generate_breakdown(resume_text, dimensions),
            'improvements': await self._generate_improvements(resume_text, dimensions),
            'confidence': 'medium' if job_description else 'low',  # Higher confidence with job context
        }
    
    def _score_ats_compatibility(self, resume_text: str) -> float:
        """Score ATS compatibility (0-100)"""
        score = 100
        penalties = {
            'has_tables_or_columns': -20 if self._has_tables(resume_text) else 0,
            'has_headers_footers': -15 if self._has_headers_footers(resume_text) else 0,
            'has_images_or_graphics': -15 if self._has_images(resume_text) else 0,
            'has_uncommon_fonts': -10 if self._has_uncommon_fonts(resume_text) else 0,
            'missing_standard_sections': -20 if not self._has_standard_sections(resume_text) else 0,
            'has_contact_in_header': -10 if self._contact_in_header(resume_text) else 0,
            'file_format_not_pdf': -10,  # Assume PDF for now
        }
        
        score += sum(penalties.values())
        return max(0, min(100, score))
    
    def _score_content_quality(self, resume_text: str) -> float:
        """Score content quality based on action verbs, metrics, specificity"""
        score = 60  # Base score
        
        # Action verbs (strong vs weak)
        strong_verbs = ['achieved', 'led', 'developed', 'implemented', 'designed', 'launched', 
                       'optimized', 'increased', 'decreased', 'reduced', 'improved', 'built',
                       'created', 'managed', 'coordinated', 'spearheaded', 'transformed']
        weak_verbs = ['helped', 'assisted', 'worked on', 'participated', 'was responsible for']
        
        strong_count = sum(1 for verb in strong_verbs if verb in resume_text.lower())
        weak_count = sum(1 for verb in weak_verbs if verb in resume_text.lower())
        
        score += strong_count * 2  # +2 per strong verb
        score -= weak_count * 3    # -3 per weak verb
        
        # Quantified achievements (numbers with % or metrics)
        metrics = len(re.findall(r'\d+%|\$\d+|\d+\s*(percent|million|billion|thousand|users|customers|revenue|growth|reduction|improvement)', resume_text.lower()))
        score += metrics * 5  # +5 per quantified metric
        
        # Length (not too short, not too long)
        word_count = len(resume_text.split())
        if 300 <= word_count <= 700:
            score += 10
        elif word_count < 200:
            score -= 20
        elif word_count > 1000:
            score -= 10
        
        # Avoid clichés
        cliches = ['team player', 'hard worker', 'detail-oriented', 'self-starter', 'results-driven',
                   'passionate about', 'think outside the box', 'synergy', 'go-getter']
        cliche_count = sum(1 for c in cliches if c in resume_text.lower())
        score -= cliche_count * 5
        
        return max(0, min(100, score))
    
    async def _score_role_relevance(self, resume_text: str, job_description: str) -> float:
        """Score how well resume matches a specific job description"""
        if not job_description:
            return 50  # Neutral score without job context
        
        # Extract keywords from job description
        job_keywords = await self._extract_keywords(job_description)
        
        # Extract keywords from resume
        resume_keywords = await self._extract_keywords(resume_text)
        
        # Calculate overlap
        required_skills = job_keywords.get('required_skills', set())
        preferred_skills = job_keywords.get('preferred_skills', set())
        
        resume_skills = set(resume_keywords.get('skills', []))
        
        # Required match (critical)
        required_match = len(required_skills & resume_skills) / len(required_skills) if required_skills else 1.0
        
        # Preferred match (bonus)
        preferred_match = len(preferred_skills & resume_skills) / len(preferred_skills) if preferred_skills else 1.0
        
        # Experience match
        required_years = job_keywords.get('experience_years', 0)
        resume_years = resume_keywords.get('experience_years', 0)
        experience_match = min(resume_years / required_years, 1.5) if required_years > 0 else 1.0
        
        # Weighted score
        score = (required_match * 0.50 + preferred_match * 0.25 + min(experience_match, 1.0) * 0.25) * 100
        
        return round(score, 1)
    
    def _score_impact_quantification(self, resume_text: str) -> float:
        """Score how well the resume quantifies impact"""
        # Count specific metrics patterns
        patterns = [
            r'\$\d+\.?\d*\s*(million|billion|k|M|B)?',  # Money
            r'\d+%',  # Percentages
            r'\d+\s*(x|times|fold)',  # Multipliers
            r'\d+\s*(users|customers|clients|people|team members|employees)',  # People
            r'\d+\s*(projects|products|features|releases|deployments)',  # Deliverables
            r'reduced\s+\w+\s+by\s+\d+',  # Reductions
            r'increased\s+\w+\s+by\s+\d+',  # Increases
            r'improved\s+\w+\s+by\s+\d+',  # Improvements
        ]
        
        total_metrics = 0
        for pattern in patterns:
            total_metrics += len(re.findall(pattern, resume_text, re.IGNORECASE))
        
        # Score: 0 metrics = 0, 1-2 = 40, 3-5 = 70, 6+ = 90-100
        if total_metrics >= 6:
            return min(90 + (total_metrics - 6) * 2, 100)
        elif total_metrics >= 3:
            return 70 + (total_metrics - 3) * 6
        elif total_metrics >= 1:
            return 40 + (total_metrics - 1) * 15
        else:
            return 0
    
    def _score_structure(self, resume_text: str) -> float:
        """Score resume structure and formatting"""
        score = 80
        
        # Check for standard sections
        sections = ['summary', 'experience', 'education', 'skills']
        for section in sections:
            if section not in resume_text.lower():
                score -= 15
        
        # Check for bullet points (not paragraphs)
        bullet_ratio = resume_text.count('•') + resume_text.count('-') / len(resume_text.split('\n'))
        if bullet_ratio < 0.3:
            score -= 10
        
        # Check for consistent formatting
        if not self._has_consistent_formatting(resume_text):
            score -= 10
        
        return max(0, min(100, score))
    
    async def _generate_breakdown(self, resume_text: str, dimensions: dict) -> list[dict]:
        """Generate detailed breakdown with specific examples"""
        # Use LLM for rich, contextual feedback
        prompt = f"""Analyze this resume and provide specific feedback on each dimension:
        
Dimensions and scores: {json.dumps(dimensions)}

Resume (first 2000 chars):
{resume_text[:2000]}

Provide 2-3 specific, actionable observations for each dimension with examples from the resume text."""
        
        response = await self.llm.generate(prompt)
        return json.loads(response)
    
    async def _generate_improvements(self, resume_text: str, dimensions: dict) -> list[dict]:
        """Generate top 3 prioritized improvements"""
        # Sort dimensions by score (lowest first = highest priority)
        sorted_dims = sorted(dimensions.items(), key=lambda x: x[1])
        
        improvements = []
        for dim_name, score in sorted_dims[:3]:
            prompt = f"""The resume scores {score}/100 on {dim_name}. 
Suggest the single most impactful improvement to increase this score by at least 15 points.
Be specific and actionable."""
            
            suggestion = await self.llm.generate(prompt)
            improvements.append({
                'dimension': dim_name,
                'current_score': score,
                'priority': len(improvements) + 1,
                'suggestion': suggestion,
                'expected_impact': '+15-20 points',
            })
        
        return improvements


# ML-Based Scoring (Version 2 — Data-Driven)
# Deploy after collecting 500+ application outcomes with resume versions

class MLResumeScoringEngine:
    """Machine learning-based resume scoring trained on real application outcomes"""
    
    def __init__(self, model_path: str = None):
        self.model = None
        self.vectorizer = None
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
    
    def train(self, application_data: list[dict]):
        """Train model on historical application data
        
        Features:
        - ATS score (heuristic)
        - Content quality score (heuristic)
        - Keyword match with job (TF-IDF)
        - Resume length (words)
        - Number of quantified metrics
        - Number of strong action verbs
        - Years of experience
        - Education level
        - Number of skills listed
        - Resume version (A/B/C/D)
        
        Target: callback_received (1/0)
        """
        import pandas as pd
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report, roc_auc_score
        
        # Prepare feature matrix
        df = pd.DataFrame(application_data)
        
        # Text features (TF-IDF on resume + job description)
        self.vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
        X_text = self.vectorizer.fit_transform(df['resume_text'] + ' ' + df['job_description'])
        
        # Numerical features
        X_num = df[['ats_score', 'content_score', 'resume_length', 'num_metrics', 
                    'num_action_verbs', 'years_experience', 'num_skills']].values
        
        # Combine features
        from scipy.sparse import hstack
        X = hstack([X_text, X_num])
        y = df['callback_received'].values
        
        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train model
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_leaf=5,
            class_weight='balanced',  # Handle class imbalance
        )
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)[:, 1]
        
        print("Classification Report:")
        print(classification_report(y_test, y_pred))
        print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.3f}")
        
        # Feature importance
        feature_names = self.vectorizer.get_feature_names_out().tolist() + [
            'ats_score', 'content_score', 'resume_length', 'num_metrics',
            'num_action_verbs', 'years_experience', 'num_skills'
        ]
        importances = self.model.feature_importances_
        top_features = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)[:20]
        print("Top 20 Features:")
        for feat, imp in top_features:
            print(f"  {feat}: {imp:.3f}")
    
    def predict_callback_probability(self, resume_text: str, job_description: str, features: dict) -> float:
        """Predict probability of callback for a resume + job combination"""
        if not self.model:
            return 0.5  # Fallback to neutral
        
        # Transform text
        X_text = self.vectorizer.transform([resume_text + ' ' + job_description])
        
        # Numerical features
        X_num = np.array([[features['ats_score'], features['content_score'], 
                          features['resume_length'], features['num_metrics'],
                          features['num_action_verbs'], features['years_experience'],
                          features['num_skills']]])
        
        from scipy.sparse import hstack
        X = hstack([X_text, X_num])
        
        prob = self.model.predict_proba(X)[0, 1]
        return prob
```

### Job Fit Prediction Model

```python
class JobFitPredictor:
    """Predict application → interview conversion probability"""
    
    def __init__(self, db_pool, resume_scorer, llm_service):
        self.db = db_pool
        self.scorer = resume_scorer
        self.llm = llm_service
    
    async def predict_conversion(
        self,
        user_id: int,
        resume_id: int,
        job_id: int,
        application_method: str = 'direct',  # direct, referral, linkedin_easy_apply, etc.
    ) -> dict:
        """Predict probability of getting an interview for this application"""
        
        # 1. Get resume and job data
        resume = await self.db.fetchrow("SELECT * FROM resumes WHERE id = $1", resume_id)
        job = await self.db.fetchrow("SELECT * FROM saved_jobs WHERE id = $1", job_id)
        
        # 2. Calculate resume score for this job
        resume_score = await self.scorer.score_resume(
            resume['optimized_text'] or resume['original_text'],
            job['description']
        )
        
        # 3. Calculate application features
        features = await self._calculate_features(user_id, resume, job, application_method)
        
        # 4. Heuristic prediction (Version 1)
        probability = self._heuristic_predict(resume_score, features)
        
        # 5. ML prediction (Version 2, if model exists)
        ml_probability = await self._ml_predict(resume_score, features)
        if ml_probability is not None:
            # Blend heuristic and ML (weighted by ML confidence)
            probability = 0.3 * probability + 0.7 * ml_probability
        
        # 6. Generate recommendations to improve probability
        recommendations = await self._generate_recommendations(resume_score, features, probability)
        
        return {
            'callback_probability': round(probability * 100, 1),
            'confidence': self._confidence_level(features),
            'resume_score': resume_score,
            'features': features,
            'recommendations': recommendations,
            'compared_to_average': self._compare_to_average(user_id, probability),
        }
    
    def _heuristic_predict(self, resume_score: dict, features: dict) -> float:
        """Heuristic prediction based on resume score and application features"""
        
        # Base probability from resume score
        base_prob = resume_score['overall_score'] / 100 * 0.4  # 0-40% from resume quality
        
        # Job fit bonus/penalty
        fit_bonus = features['role_relevance'] * 0.30  # 0-30% from role fit
        
        # Experience match
        exp_match = features['experience_match'] * 0.15  # 0-15% from experience alignment
        
        # Application method bonus
        method_bonus = {
            'referral': 0.10,
            'direct_company': 0.05,
            'linkedin_easy_apply': 0.0,
            'job_board': -0.05,
            'mass_apply': -0.10,
        }.get(features['application_method'], 0.0)
        
        # Time-of-application bonus (historical data shows Tuesday morning is best)
        time_bonus = features.get('time_bonus', 0.0)
        
        # Company size bonus (startups more likely to respond to tailored applications)
        company_bonus = 0.05 if features['company_size'] == 'startup' else 0.0
        
        probability = base_prob + fit_bonus + exp_match + method_bonus + time_bonus + company_bonus
        
        # Clamp to 0-1
        return max(0.05, min(0.95, probability))
    
    async def _calculate_features(self, user_id, resume, job, application_method) -> dict:
        """Calculate all features for prediction"""
        
        # User's historical conversion rate
        user_history = await self.db.fetchrow(
            """SELECT 
                COUNT(*) as total_applications,
                SUM(CASE WHEN status IN ('interview', 'offer', 'hired') THEN 1 ELSE 0 END) as callbacks
               FROM applications WHERE user_id = $1""",
            user_id
        )
        
        historical_rate = (user_history['callbacks'] / user_history['total_applications'] 
                          if user_history['total_applications'] > 0 else 0.1)
        
        return {
            'role_relevance': await self._calculate_role_relevance(resume, job),
            'experience_match': self._calculate_experience_match(resume, job),
            'application_method': application_method,
            'company_size': job.get('company_size', 'unknown'),
            'historical_callback_rate': historical_rate,
            'time_bonus': self._calculate_time_bonus(),
            'user_avg_resume_score': await self._get_user_avg_resume_score(user_id),
            'job_competition_level': await self._estimate_competition(job),
        }
    
    def _calculate_time_bonus(self) -> float:
        """Calculate bonus based on day/time of application"""
        now = datetime.now()
        weekday = now.weekday()  # 0=Monday, 6=Sunday
        hour = now.hour
        
        # Data shows Tuesday-Thursday mornings are best
        if weekday in [1, 2, 3] and 9 <= hour <= 11:
            return 0.03
        elif weekday in [0, 4] and 9 <= hour <= 11:
            return 0.01
        elif weekday in [5, 6] or hour < 6 or hour > 20:
            return -0.02
        
        return 0.0
    
    async def _generate_recommendations(self, resume_score, features, probability) -> list[dict]:
        """Generate actionable recommendations to improve callback probability"""
        
        recommendations = []
        
        if resume_score['dimensions']['role_relevance'] < 60:
            recommendations.append({
                'priority': 'high',
                'action': 'tailor_resume',
                'title': 'Tailor Your Resume for This Role',
                'description': f'Your resume matches only {resume_score["dimensions"]["role_relevance"]}% of this job. Use our resume optimizer to add missing keywords.',
                'expected_impact': '+15-25% callback probability',
                'cta': 'Optimize for This Job',
            })
        
        if resume_score['dimensions']['impact_quantification'] < 50:
            recommendations.append({
                'priority': 'high',
                'action': 'add_metrics',
                'title': 'Add Quantified Achievements',
                'description': 'Your resume lacks specific metrics. Add numbers, percentages, and dollar amounts to your achievements.',
                'expected_impact': '+10-15% callback probability',
                'cta': 'See Examples',
            })
        
        if features['application_method'] == 'mass_apply':
            recommendations.append({
                'priority': 'medium',
                'action': 'personalize',
                'title': 'Personalize Your Application',
                'description': 'Mass applications have lower response rates. Write a tailored cover letter using our generator.',
                'expected_impact': '+5-10% callback probability',
                'cta': 'Generate Cover Letter',
            })
        
        if features['job_competition_level'] == 'high':
            recommendations.append({
                'priority': 'medium',
                'action': 'find_referral',
                'title': 'Find a Referral',
                'description': 'This role is highly competitive. A referral can increase your callback rate by 10x.',
                'expected_impact': '+40-50% callback probability',
                'cta': 'Search LinkedIn Connections',
            })
        
        if probability < 0.2:
            recommendations.append({
                'priority': 'low',
                'action': 'consider_alternatives',
                'title': 'Consider Similar Roles',
                'description': 'Your profile is a weak match for this role. Consider applying to similar roles where you have a stronger fit.',
                'expected_impact': 'Find better-fit opportunities',
                'cta': 'Find Similar Roles',
            })
        
        return recommendations
    
    def _compare_to_average(self, user_id: int, probability: float) -> dict:
        """Compare user's probability to platform average"""
        # This would query platform-wide averages
        avg_probability = 0.15  # 15% average callback rate (industry standard)
        
        return {
            'user_probability': round(probability * 100, 1),
            'platform_average': round(avg_probability * 100, 1),
            'difference': round((probability - avg_probability) * 100, 1),
            'percentile': self._calculate_percentile(probability),
            'interpretation': 'above average' if probability > avg_probability else 'below average',
        }
    
    def _calculate_percentile(self, probability: float) -> int:
        """Calculate percentile rank based on probability distribution"""
        # Simplified: assume normal distribution with mean=0.15, std=0.08
        import scipy.stats as stats
        return int(stats.norm.cdf(probability, loc=0.15, scale=0.08) * 100)
```

---

## A/B Testing & Multi-Armed Bandit Architecture

### Resume Variant A/B Testing

Tayari already generates 4 resume variants (A/B/C/D). The bandit system determines which variant performs best and automatically shifts traffic toward the winner.

```python
import numpy as np
from scipy.stats import beta
from dataclasses import dataclass
from typing import Dict, List
import json

@dataclass
class BanditArm:
    """Represents one resume variant (A/B/C/D)"""
    variant_id: str  # 'A', 'B', 'C', 'D'
    resume_id: int
    alpha: float = 1.0  # Successes (callbacks) + prior
    beta: float = 1.0   # Failures (no callbacks) + prior
    total_applications: int = 0
    total_callbacks: int = 0
    
    @property
    def conversion_rate(self) -> float:
        return self.total_callbacks / self.total_applications if self.total_applications > 0 else 0.0
    
    @property
    def posterior_mean(self) -> float:
        """Expected value of Beta distribution"""
        return self.alpha / (self.alpha + self.beta)
    
    def sample(self) -> float:
        """Thompson Sampling: draw a sample from Beta(alpha, beta)"""
        return np.random.beta(self.alpha, self.beta)
    
    def update(self, success: bool):
        """Update after observing an outcome"""
        self.total_applications += 1
        if success:
            self.total_callbacks += 1
            self.alpha += 1
        else:
            self.beta += 1

class ResumeBanditSystem:
    """Multi-armed bandit for testing resume variants using Thompson Sampling"""
    
    def __init__(self, db_pool):
        self.db = db_pool
        self.arms: Dict[str, Dict[str, BanditArm]] = {}  # user_id -> {variant_id -> BanditArm}
    
    async def load_user_bandit(self, user_id: int, resume_id: int) -> Dict[str, BanditArm]:
        """Load or initialize bandit arms for a user's resume variants"""
        
        if str(user_id) in self.arms:
            return self.arms[str(user_id)]
        
        # Load historical data from database
        rows = await self.db.fetch(
            """SELECT 
                resume_version,
                COUNT(*) as total,
                SUM(CASE WHEN a.status IN ('interview', 'offer', 'hired') THEN 1 ELSE 0 END) as callbacks
               FROM applications a
               JOIN resumes r ON a.resume_id = r.id
               WHERE a.user_id = $1 AND r.parent_resume_id = $2
               GROUP BY resume_version""",
            user_id, resume_id
        )
        
        arms = {}
        for variant in ['A', 'B', 'C', 'D']:
            row = next((r for r in rows if r['resume_version'] == variant), None)
            
            if row:
                arms[variant] = BanditArm(
                    variant_id=variant,
                    resume_id=resume_id,  # Would need actual variant resume_id
                    alpha=1.0 + row['callbacks'],
                    beta=1.0 + (row['total'] - row['callbacks']),
                    total_applications=row['total'],
                    total_callbacks=row['callbacks'],
                )
            else:
                arms[variant] = BanditArm(variant_id=variant, resume_id=resume_id)
        
        self.arms[str(user_id)] = arms
        return arms
    
    async def select_variant(self, user_id: int, resume_id: int, exploration_rate: float = 0.1) -> str:
        """Select which resume variant to use for next application
        
        Uses Thompson Sampling with epsilon-greedy exploration:
        - 90% of time: sample from Beta posterior and pick highest
        - 10% of time: randomly explore (ensures all variants get some traffic)
        """
        arms = await self.load_user_bandit(user_id, resume_id)
        
        # Epsilon-greedy exploration
        if np.random.random() < exploration_rate:
            return np.random.choice(list(arms.keys()))
        
        # Thompson Sampling: draw from each arm's posterior and pick max
        samples = {variant: arm.sample() for variant, arm in arms.items()}
        return max(samples, key=samples.get)
    
    async def record_outcome(self, user_id: int, resume_id: int, variant: str, success: bool):
        """Record application outcome and update bandit"""
        arms = await self.load_user_bandit(user_id, resume_id)
        arms[variant].update(success)
        
        # Persist to database
        await self.db.execute(
            """INSERT INTO resume_variant_performance 
               (user_id, resume_id, variant, applications, callbacks, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT (user_id, resume_id, variant) 
               DO UPDATE SET applications = $4, callbacks = $5, updated_at = NOW()""",
            user_id, resume_id, variant,
            arms[variant].total_applications,
            arms[variant].total_callbacks,
        )
    
    async def get_bandit_stats(self, user_id: int, resume_id: int) -> dict:
        """Get current bandit statistics for user dashboard"""
        arms = await self.load_user_bandit(user_id, resume_id)
        
        stats = []
        for variant, arm in arms.items():
            # Calculate confidence interval for conversion rate
            # Using Beta distribution properties
            mean = arm.posterior_mean
            variance = (arm.alpha * arm.beta) / ((arm.alpha + arm.beta)**2 * (arm.alpha + arm.beta + 1))
            std = np.sqrt(variance)
            
            stats.append({
                'variant': variant,
                'applications': arm.total_applications,
                'callbacks': arm.total_callbacks,
                'conversion_rate': round(arm.conversion_rate * 100, 1),
                'posterior_mean': round(mean * 100, 1),
                'confidence_interval': [
                    round(max(0, mean - 1.96 * std) * 100, 1),
                    round(min(1, mean + 1.96 * std) * 100, 1),
                ],
                'probability_best': await self._estimate_probability_best(arm, arms.values()),
                'recommendation': 'winner' if arm.posterior_mean == max(a.posterior_mean for a in arms.values()) else 'testing',
            })
        
        # Sort by posterior mean
        stats.sort(key=lambda x: x['posterior_mean'], reverse=True)
        
        return {
            'total_applications': sum(s['applications'] for s in stats),
            'total_callbacks': sum(s['callbacks'] for s in stats),
            'overall_conversion_rate': round(
                sum(s['callbacks'] for s in stats) / sum(s['applications'] for s in stats) * 100, 1
            ) if sum(s['applications'] for s in stats) > 0 else 0,
            'variants': stats,
            'winner': stats[0]['variant'] if stats[0]['probability_best'] > 0.5 else None,
            'recommendation': self._generate_recommendation(stats),
        }
    
    async def _estimate_probability_best(self, arm: BanditArm, all_arms: List[BanditArm], n_samples: int = 10000) -> float:
        """Monte Carlo estimate of probability that this arm is the best"""
        # Draw samples from all arms
        samples = {}
        for a in all_arms:
            samples[a.variant_id] = np.random.beta(a.alpha, a.beta, n_samples)
        
        # Count how often this arm has the highest sample
        best_count = sum(
            1 for i in range(n_samples)
            if all(samples[arm.variant_id][i] >= samples[a.variant_id][i] for a in all_arms)
        )
        
        return round(best_count / n_samples, 3)
    
    def _generate_recommendation(self, stats: list) -> str:
        """Generate human-readable recommendation"""
        winner = stats[0]
        
        if winner['applications'] < 10:
            return f"Variant {winner['variant']} is leading but needs more data. Keep applying to reach statistical significance."
        
        if winner['probability_best'] > 0.7:
            return f"Variant {winner['variant']} is the clear winner with {winner['conversion_rate']}% callback rate. Consider using this variant for most applications."
        
        if winner['probability_best'] > 0.5:
            return f"Variant {winner['variant']} is likely the best, but the difference is small. Continue testing."
        
        return "All variants are performing similarly. Try different resume versions or target different roles."


# Database schema for bandit tracking
"""
CREATE TABLE resume_variant_performance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    variant VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
    applications INTEGER NOT NULL DEFAULT 0,
    callbacks INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, resume_id, variant)
);

CREATE INDEX idx_resume_variant_performance_user ON resume_variant_performance(user_id, resume_id);
"""
```

### Bandit Visualization Component

```typescript
// src/components/ResumeBanditStats.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, ResponsiveContainer } from 'recharts';

interface BanditVariant {
  variant: string;
  applications: number;
  callbacks: number;
  conversionRate: number;
  confidenceInterval: [number, number];
  probabilityBest: number;
  recommendation: string;
}

export function ResumeBanditStats({ stats }: { stats: BanditVariant[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resume A/B Test Results</h3>
        <span className="text-sm text-gray-500">
          {stats.reduce((sum, s) => sum + s.applications, 0)} applications tracked
        </span>
      </div>
      
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="variant" />
            <YAxis tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value: number, name: string) => {
              if (name === 'conversionRate') return `${value}%`;
              return value;
            }} />
            <Bar dataKey="conversionRate" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              <ErrorBar dataKey="confidenceInterval" width={20} strokeWidth={2} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((variant) => (
          <div key={variant.variant} 
               className={`p-4 rounded-lg border ${variant.probabilityBest > 0.5 ? 'border-green-500 bg-green-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-lg">Variant {variant.variant}</span>
              {variant.probabilityBest > 0.5 && (
                <span className="text-green-600 text-sm font-semibold">🏆 Winner</span>
              )}
            </div>
            <p className="text-2xl font-bold text-blue-600">{variant.conversionRate}%</p>
            <p className="text-sm text-gray-500">
              {variant.callbacks} / {variant.applications} applications
            </p>
            <p className="text-sm text-gray-500">
              {Math.round(variant.probabilityBest * 100)}% chance best
            </p>
          </div>
        ))}
      </div>
      
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="font-semibold text-blue-800">💡 Recommendation</p>
        <p className="text-blue-700 mt-1">
          {stats[0]?.recommendation || 'Keep testing to find the best variant.'}
        </p>
      </div>
    </div>
  );
}
```

---

## Personalized Recommendation Engine

### Insight Generation System

```python
class PersonalizedInsightEngine:
    """Generate personalized insights based on user's application history and patterns"""
    
    def __init__(self, db_pool, llm_service):
        self.db = db_pool
        self.llm = llm_service
    
    async def generate_insights(self, user_id: int) -> list[dict]:
        """Generate personalized insights for user's dashboard"""
        
        insights = []
        
        # 1. Conversion rate by role type
        role_insights = await self._analyze_role_conversion(user_id)
        if role_insights:
            insights.append(role_insights)
        
        # 2. Conversion rate by application time
        time_insights = await self._analyze_time_patterns(user_id)
        if time_insights:
            insights.append(time_insights)
        
        # 3. Conversion rate by company size
        company_insights = await self._analyze_company_patterns(user_id)
        if company_insights:
            insights.append(company_insights)
        
        # 4. Resume variant performance
        variant_insights = await self._analyze_variant_performance(user_id)
        if variant_insights:
            insights.append(variant_insights)
        
        # 5. Skill gap impact on conversion
        skill_insights = await self._analyze_skill_impact(user_id)
        if skill_insights:
            insights.append(skill_insights)
        
        # 6. Generate LLM-powered narrative insights
        narrative_insights = await self._generate_narrative_insights(user_id)
        insights.extend(narrative_insights)
        
        # Sort by impact/priority
        insights.sort(key=lambda x: x.get('impact_score', 0), reverse=True)
        
        return insights[:5]  # Top 5 insights
    
    async def _analyze_role_conversion(self, user_id: int) -> dict:
        """Analyze which role types have highest conversion rates"""
        
        rows = await self.db.fetch(
            """SELECT 
                job_role_category,
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('interview', 'offer', 'hired') THEN 1 ELSE 0 END) as callbacks,
                AVG(resume_score) as avg_resume_score
               FROM applications a
               JOIN saved_jobs j ON a.job_id = j.id
               WHERE a.user_id = $1 AND a.created_at > NOW() - INTERVAL '90 days'
               GROUP BY job_role_category
               HAVING COUNT(*) >= 5""",
            user_id
        )
        
        if not rows or len(rows) < 2:
            return None
        
        # Find best and worst performing roles
        best = max(rows, key=lambda r: r['callbacks'] / r['total'] if r['total'] > 0 else 0)
        worst = min(rows, key=lambda r: r['callbacks'] / r['total'] if r['total'] > 0 else 1)
        
        best_rate = best['callbacks'] / best['total'] * 100
        worst_rate = worst['callbacks'] / worst['total'] * 100
        
        if best_rate <= worst_rate * 1.5:  # Less than 1.5x difference, not significant
            return None
        
        return {
            'type': 'role_conversion',
            'title': f"Your {best['job_role_category']} applications are {best_rate/worst_rate:.1f}x more successful",
            'description': f"You have a {best_rate:.0f}% callback rate for {best['job_role_category']} roles vs {worst_rate:.0f}% for {worst['job_role_category']}. Consider focusing more on {best['job_role_category']} positions.",
            'impact_score': min(best_rate / worst_rate, 5.0),  # Cap at 5
            'action': 'focus_role',
            'data': {
                'best_role': best['job_role_category'],
                'best_rate': best_rate,
                'worst_role': worst['job_role_category'],
                'worst_rate': worst_rate,
            },
        }
    
    async def _analyze_time_patterns(self, user_id: int) -> dict:
        """Analyze which days/times have best conversion rates"""
        
        rows = await self.db.fetch(
            """SELECT 
                EXTRACT(DOW FROM applied_at) as day_of_week,
                EXTRACT(HOUR FROM applied_at) as hour,
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('interview', 'offer', 'hired') THEN 1 ELSE 0 END) as callbacks
               FROM applications
               WHERE user_id = $1 AND applied_at > NOW() - INTERVAL '90 days'
               GROUP BY day_of_week, hour
               HAVING COUNT(*) >= 3""",
            user_id
        )
        
        if not rows:
            return None
        
        # Find best day/hour combination
        best = max(rows, key=lambda r: r['callbacks'] / r['total'] if r['total'] > 0 else 0)
        best_rate = best['callbacks'] / best['total'] * 100
        
        if best_rate < 20:  # Need at least 20% to be meaningful
            return None
        
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        best_day = days[int(best['day_of_week'])]
        best_hour = int(best['hour'])
        
        return {
            'type': 'time_pattern',
            'title': f"Apply on {best_day}s at {best_hour}:00 for best results",
            'description': f"Your applications on {best_day}s at {best_hour}:00 have a {best_rate:.0f}% callback rate. This is significantly higher than your average.",
            'impact_score': best_rate / 10,  # Higher rate = higher impact
            'action': 'optimize_timing',
            'data': {
                'best_day': best_day,
                'best_hour': best_hour,
                'conversion_rate': best_rate,
            },
        }
    
    async def _generate_narrative_insights(self, user_id: int) -> list[dict]:
        """Generate LLM-powered narrative insights from user's data"""
        
        # Get user's summary data
        summary = await self.db.fetchrow(
            """SELECT 
                COUNT(*) as total_applications,
                SUM(CASE WHEN status IN ('interview', 'offer', 'hired') THEN 1 ELSE 0 END) as callbacks,
                AVG(resume_score) as avg_resume_score,
                COUNT(DISTINCT job_role_category) as role_diversity
               FROM applications a
               LEFT JOIN saved_jobs j ON a.job_id = j.id
               WHERE a.user_id = $1 AND a.created_at > NOW() - INTERVAL '90 days'""",
            user_id
        )
        
        if not summary or summary['total_applications'] < 10:
            return []
        
        conversion_rate = summary['callbacks'] / summary['total_applications'] * 100
        
        prompt = f"""Generate 2 personalized, actionable insights for a job seeker based on their data:

Data:
- Total applications: {summary['total_applications']}
- Callbacks: {summary['callbacks']}
- Conversion rate: {conversion_rate:.1f}%
- Average resume score: {summary['avg_resume_score']:.1f}/100
- Role diversity: {summary['role_diversity']} different role types

Guidelines:
- Be specific and data-driven
- Provide actionable next steps
- Be encouraging but honest
- Keep each insight to 1-2 sentences
- Focus on what they can CONTROL (not luck or market conditions)

Return as JSON array with fields: type, title, description, action (what to do), impact_score (1-5)."""
        
        response = await self.llm.generate(prompt)
        return json.loads(response)
```

### Insight Card Component

```typescript
// src/components/InsightCard.tsx
interface Insight {
  type: string;
  title: string;
  description: string;
  action: string;
  impact_score: number;
  data?: any;
}

export function InsightCard({ insight }: { insight: Insight }) {
  const impactColors = {
    1: 'bg-gray-100 border-gray-300',
    2: 'bg-blue-50 border-blue-300',
    3: 'bg-yellow-50 border-yellow-300',
    4: 'bg-orange-50 border-orange-300',
    5: 'bg-red-50 border-red-300',
  };
  
  const impactLabels = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Very High',
    5: 'Critical',
  };
  
  return (
    <div className={`p-4 rounded-lg border ${impactColors[insight.impact_score] || impactColors[3]}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{insight.title}</h4>
        <span className={`text-xs px-2 py-1 rounded-full font-medium
          ${insight.impact_score >= 4 ? 'bg-red-100 text-red-700' : ''}
          ${insight.impact_score === 3 ? 'bg-yellow-100 text-yellow-700' : ''}
          ${insight.impact_score <= 2 ? 'bg-blue-100 text-blue-700' : ''}
        `}>
          {impactLabels[insight.impact_score]} Impact
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
      <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
        {insight.action === 'focus_role' && 'View Matching Roles →'}
        {insight.action === 'optimize_timing' && 'Set Application Reminder →'}
        {insight.action === 'tailor_resume' && 'Optimize Resume →'}
        {insight.action === 'find_referral' && 'Search Connections →'}
        {insight.action === 'add_metrics' && 'See Examples →'}
      </button>
    </div>
  );
}
```

---

## Implementation Architecture

### ML Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PREDICTIVE ANALYTICS PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  DATA SOURCES    │                                                       │
│  │                  │                                                       │
│  │ • resumes        │──┐                                                    │
│  │ • job_descriptions│  │                                                   │
│  │ • applications   │──┼──┐                                                  │
│  │ • profiles       │──┼──┼──┐                                               │
│  │ • interview_scores│──┼──┼──┼──┐                                          │
│  │                  │  │  │  │  │                                            │
│  └──────────────────┘  │  │  │  │                                            │
│                        │  │  │  │                                            │
│  ┌──────────────────┐  │  │  │  │                                            │
│  │ FEATURE ENGINEER │◄─┘──┘──┘──┘                                            │
│  │ (Python/pandas)  │                                                        │
│  │                  │                                                        │
│  │ • ATS score      │                                                        │
│  │ • Content score  │                                                        │
│  │ • Keyword match  │                                                        │
│  │ • Experience yrs │                                                        │
│  │ • Time features  │                                                        │
│  │ • User history   │                                                        │
│  │ • Job features   │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│  ┌────────▼─────────┐     ┌──────────────────┐                             │
│  │ FEATURE STORE    │────→│ PostgreSQL       │                             │
│  │ (pre-computed)   │     │ • user_features  │                             │
│  │                  │     │ • job_features   │                             │
│  │ Updated nightly  │     │ • resume_features│                             │
│  └──────────────────┘     │ • interaction_features                         │
│                             └──────────────────┘                             │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │ MODEL TRAINING   │  ←── Triggered when N > 500 applications            │
│  │ (scikit-learn)   │                                                       │
│  │                  │                                                       │
│  │ • Heuristic v1   │  ←── Default (always available)                      │
│  │ • Logistic Reg v2│  ←── 100+ applications                                │
│  │ • Random Forest  │  ←── 500+ applications                                │
│  │ • XGBoost v3     │  ←── 2000+ applications                               │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│  ┌────────▼─────────┐     ┌──────────────────┐                             │
│  │ MODEL SERVING    │────→│ FastAPI endpoint │                             │
│  │ (cached models)    │     │ /predict/callback  │                             │
│  │                  │     │ /predict/fit       │                             │
│  │ • Load model     │     │ /bandit/select     │                             │
│  │ • Predict        │     │ /insights/generate │                             │
│  │ • Return probs   │     │                    │                             │
│  └──────────────────┘     └──────────────────┘                             │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │ A/B TESTING      │                                                       │
│  │ (Thompson Sampling)                                                      │
│  │                  │                                                       │
│  │ • 4 variants     │                                                       │
│  │ • Beta posterior │                                                       │
│  │ • Auto-select    │                                                       │
│  │ • Update on outcome│                                                     │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cron Jobs

```python
# Scheduled jobs for predictive analytics

# 1. Nightly feature computation
@cron.schedule("0 2 * * *")  # 2 AM daily
async def compute_features():
    """Pre-compute features for all users and recent jobs"""
    # Compute user features (historical conversion rates, avg resume scores)
    # Compute job features (competition level, posting freshness)
    # Compute resume features (ATS scores, content scores)
    # Store in feature_store table

# 2. Weekly model retraining (if enough data)
@cron.schedule("0 3 * * 0")  # 3 AM Sunday
async def retrain_models():
    """Retrain ML models if we have enough new data"""
    # Check if we have 100+ new applications since last training
    # If yes, retrain logistic regression or random forest
    # Save model to disk, update model registry

# 3. Daily insight generation
@cron.schedule("0 6 * * *")  # 6 AM daily
async def generate_daily_insights():
    """Generate personalized insights for active users"""
    # Find users with 5+ applications in last 30 days
    # Generate insights for each user
    # Store in user_insights table
    # Push notification for high-impact insights
```

### Database Schema Additions

```sql
-- Feature store (pre-computed features for fast prediction)
CREATE TABLE user_features (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_applications INTEGER DEFAULT 0,
    total_callbacks INTEGER DEFAULT 0,
    historical_conversion_rate DECIMAL(5,4),
    avg_resume_score DECIMAL(5,2),
    top_performing_role VARCHAR(100),
    top_performing_role_rate DECIMAL(5,4),
    worst_performing_role VARCHAR(100),
    worst_performing_role_rate DECIMAL(5,4),
    best_application_day INTEGER, -- 0=Sunday, 1=Monday, etc.
    best_application_hour INTEGER,
    role_diversity INTEGER, -- number of different roles applied
    avg_time_to_callback_days DECIMAL(5,2),
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_features_user ON user_features(user_id);

-- Job features
CREATE TABLE job_features (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES saved_jobs(id) ON DELETE CASCADE,
    competition_level VARCHAR(20), -- 'low', 'medium', 'high'
    estimated_applicants INTEGER,
    posting_freshness_days INTEGER,
    salary_competitiveness DECIMAL(5,2), -- compared to market
    required_skills_count INTEGER,
    preferred_skills_count INTEGER,
    experience_requirement_years INTEGER,
    is_remote BOOLEAN,
    company_size VARCHAR(50),
    company_growth_rate DECIMAL(5,2), -- from external data if available
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(job_id)
);

-- Resume features
CREATE TABLE resume_features (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    ats_score INTEGER,
    content_score INTEGER,
    impact_score INTEGER,
    structure_score INTEGER,
    word_count INTEGER,
    strong_action_verb_count INTEGER,
    weak_action_verb_count INTEGER,
    quantified_metric_count INTEGER,
    cliche_count INTEGER,
    skill_count INTEGER,
    years_experience INTEGER,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(resume_id)
);

-- Application predictions (store predictions to track accuracy over time)
CREATE TABLE application_predictions (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    predicted_callback_probability DECIMAL(5,4) NOT NULL,
    model_version VARCHAR(20) NOT NULL, -- 'heuristic_v1', 'logistic_v2', etc.
    features_used JSONB,
    predicted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    actual_outcome BOOLEAN, -- NULL until outcome is known
    outcome_recorded_at TIMESTAMP,
    model_accuracy DECIMAL(5,4), -- computed after outcome known
    UNIQUE(application_id, model_version)
);

CREATE INDEX idx_application_predictions_app ON application_predictions(application_id);
CREATE INDEX idx_application_predictions_model ON application_predictions(model_version);

-- User insights (generated daily)
CREATE TABLE user_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    impact_score INTEGER NOT NULL CHECK (impact_score BETWEEN 1 AND 5),
    data JSONB,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_user_insights_user ON user_insights(user_id, is_dismissed, expires_at);

-- Resume variant performance (for bandit tracking)
CREATE TABLE resume_variant_performance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    variant VARCHAR(10) NOT NULL,
    applications INTEGER NOT NULL DEFAULT 0,
    callbacks INTEGER NOT NULL DEFAULT 0,
    alpha_prior DECIMAL(10,4) DEFAULT 1.0,
    beta_prior DECIMAL(10,4) DEFAULT 1.0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, resume_id, variant)
);

CREATE INDEX idx_resume_variant_performance_user ON resume_variant_performance(user_id, resume_id);
```

### Frontend Components

```typescript
// src/pages/AnalyticsDashboard.tsx
// Predictive Analytics Dashboard — the user's personal optimization lab

// Features:
// 1. Funnel Visualization (applied → screening → interview → offer → hired)
// 2. Conversion Rate by Dimension (role, time, company size, resume variant)
// 3. Resume Score Card (current score + breakdown + improvement tips)
// 4. A/B Test Results (variant performance with confidence intervals)
// 5. Predicted Callback Probability (for each upcoming application)
// 6. Personalized Insights (top 5 data-driven recommendations)
// 7. Application Timing Optimizer (best days/hours based on user's history)

// Route: /analytics
// Accessible from Dashboard and Profile
```

---

## Integration with Tayari Stack

| Tayari Feature | Integration Point | Data Flow |
|---------------|-------------------|-----------|
| **Resume Optimizer** | Score each optimized version | Resume text → scoring engine → score stored in resume_features |
| **Job Search** | Predict callback probability before applying | Resume + job → predict → show probability in UI |
| **Application Tracking** | Record outcomes to train models | Status changes → update bandit → retrain model |
| **Interview Board** | Interview success prediction | Application data → predict interview → offer conversion |
| **Browser Extension** | Real-time fit score on job pages | Detected job + resume → quick fit score overlay |
| **Dashboard** | Analytics summary cards | Funnel stats, insights, bandit results → dashboard widgets |
| **Career Intelligence** | Skill gap impact on conversion | Gap analysis + historical conversion → "learn X to improve by Y%" |

### Cross-Feature User Journey

```
User Journey: "Optimize My Application Strategy"

1. User applies to 5 jobs using different resume variants
2. System tracks which variant was used for each application
3. After 2 weeks, 2 callbacks received (both from Variant B)
4. Bandit system updates: Variant B alpha=3, beta=2; others alpha=1, beta=2
5. System shows A/B test results: "Variant B has 67% callback rate vs 0% for others"
6. System recommends: "Use Variant B for your next 5 applications"
7. System generates insight: "Your Frontend roles get 3x more callbacks than Backend"
8. System generates insight: "Applications on Tuesday at 10 AM have 2x higher response rate"
9. User adjusts strategy: focuses on Frontend roles, applies on Tuesday mornings
10. System shows predicted callback probability before each application: "65% chance for this role"
11. User sees skill gap: "Adding Kubernetes would increase your match score by 15%"
12. User completes learning path → updates resume → predicted probability increases to 78%
```

---

## Competitive Analysis

| Competitor | Resume Scoring? | A/B Testing? | Predictive Analytics? | Personalized Insights? | Free? |
|------------|---------------|-------------|----------------------|----------------------|-------|
| **Jobscan** | ✅ Yes (ATS match) | ❌ No | ❌ No | ❌ No | ✅ Limited |
| **Teal** | ✅ Yes (match score) | ❌ No | ❌ No | ✅ Yes (limited) | ✅ Yes |
| **Rezi** | ✅ Yes (Rezi Score) | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Qwyse** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **LinkedIn Premium** | ❌ No | ❌ No | ⚠️ Limited (applicant insights) | ✅ Yes | ❌ No |
| **FastApply** | ❌ No | ❌ No | ❌ No | ❌ No | ⚠️ Limited |
| **Tayari (planned)** | ✅ **Multi-dimensional** | ✅ **Thompson Sampling** | ✅ **Callback probability** | ✅ **Data-driven** | ✅ **Free** |

**Tayari's Differentiation:**
1. **Only platform** with multi-dimensional resume scoring (not just keyword match)
2. **Only platform** with Thompson Sampling bandit for resume variant testing
3. **Only platform** that predicts callback probability BEFORE applying
4. **Only platform** with personalized insights based on user's actual historical data
5. **Only platform** that connects predictions to actionable improvements (resume optimizer, learning paths)

---

## Implementation Roadmap

### Phase 1: Resume Scoring (Weeks 1-3)
- **Tasks:**
  - Build heuristic resume scoring engine (5 dimensions)
  - Integrate with resume optimizer (score each variant after optimization)
  - Create database schema for resume_features
  - Build resume score card UI (radar chart + breakdown + improvements)
  - Add scoring to resume preview page
- **Deliverable:** Working resume score card with actionable feedback

### Phase 2: Job Fit Prediction (Weeks 4-5)
- **Tasks:**
  - Build job fit prediction heuristic (resume + job description → probability)
  - Integrate with job search (show fit score on each job card)
  - Add "predicted callback probability" to application confirmation
  - Create database schema for application_predictions
  - Build prediction accuracy tracking (compare predicted vs actual)
- **Deliverable:** Callback probability shown before each application

### Phase 3: A/B Bandit Testing (Weeks 6-7)
- **Tasks:**
  - Implement Thompson Sampling bandit system
  - Track which variant is used per application
  - Build bandit statistics dashboard (conversion rates, confidence intervals, winner)
  - Auto-suggest best variant for next application
  - Add "Use Best Variant" button to application flow
- **Deliverable:** Auto-optimized resume variant selection with A/B test results

### Phase 4: Personalized Insights (Weeks 8-9)
- **Tasks:**
  - Build insight generation engine (role conversion, time patterns, company patterns)
  - Implement daily insight generation cron job
  - Create insights dashboard (top 5 cards with actions)
  - Add insight notifications (push/email for high-impact insights)
  - Build LLM-powered narrative insights for complex patterns
- **Deliverable:** Personalized insights dashboard with data-driven recommendations

### Phase 5: ML Upgrade (Weeks 10+, conditional on data volume)
- **Tasks:**
  - Collect 500+ application outcomes
  - Train logistic regression model
  - A/B test heuristic vs ML predictions
  - If ML outperforms, switch to ML as primary predictor
  - Implement model retraining pipeline
- **Deliverable:** ML-powered predictions (when data supports it)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Insufficient data for ML** | High | High | Start with heuristics; ML only when N > 500; be transparent about confidence levels |
| **Predictions are wrong** | Medium | High | Show confidence intervals; track accuracy; adjust models; never guarantee outcomes |
| **User over-relies on predictions** | Medium | Medium | Frame as "probability" not "guarantee"; encourage applying broadly regardless of score |
| **Bandit convergence too slow** | Medium | Medium | Use informative priors (from platform-wide data); lower exploration rate after initial period |
| **Cold start (new user, no history)** | High | Medium | Use platform-wide averages as priors; ask user about past experience; generic insights first |
| **Self-fulfilling prophecy** | Low | High | If user only applies to high-probability jobs, they might miss opportunities; encourage balanced approach |
| **Privacy concerns** | Low | Medium | All predictions computed locally; no sharing of individual data; aggregate statistics only |
| **Overfitting to small sample** | Medium | High | Regularization in ML models; minimum sample size requirements; Bayesian priors |

---

## Recommended Next Steps

### Immediate (Week 1)
1. **Implement heuristic resume scoring** — 5 dimensions, no ML needed
2. **Add resume score to optimizer output** — Show score after each optimization
3. **Create database schema** — All predictive analytics tables

### Short-Term (Weeks 2-4)
4. **Build job fit prediction** — Simple heuristic based on keyword match + experience
5. **Add predicted probability to job search** — "78% match" badge on job cards
6. **Track application outcomes properly** — Ensure status changes are recorded correctly
7. **Build resume score card UI** — Radar chart + breakdown + top 3 improvements

### Medium-Term (Weeks 5-7)
8. **Implement Thompson Sampling bandit** — 4 variants, update on outcome
9. **Build A/B test results dashboard** — Conversion rates, confidence intervals, winner
10. **Add auto-variant selection** — "Use Variant B (best performing)" button
11. **Build insight generation engine** — Role conversion, time patterns, company patterns

### Long-Term (Weeks 8-10)
12. **Create personalized insights dashboard** — Top 5 data-driven recommendations
13. **Add insight notifications** — Push/email for high-impact insights
14. **Implement ML pipeline** — Trigger when 500+ applications collected
15. **Build full analytics dashboard** — Funnel visualization, conversion trends, predictions

---

## Verified Resources

- **Multi-Armed Bandit Theory:** https://splitmetrics.com/blog/sequential-ab-testing-vs-multi-armed-bandit/ — Sequential A/B testing vs MAB comparison
- **Thompson Sampling Explained:** https://www.abtasty.com/glossary/multi-armed-bandit/ — MAB algorithms and exploration/exploitation
- **AI-Powered MAB for CRO:** https://www.kolect.ai/blog/beyond-a-b-implementing-multi-armed-bandit-testing-with-ai-for-continuous-conversion-rate-optimization-944 — Production MAB implementation
- **Thompson Sampling for Budgeted MAB:** https://www.ijcai.org/Proceedings/15/Papers/556.pdf — Academic paper on Thompson Sampling
- **scikit-learn Classification:** https://scikit-learn.org/stable/modules/classes.html — ML model implementations
- **XGBoost Documentation:** https://xgboost.readthedocs.io/ — Gradient boosting framework
- **Bayesian Methods for Bandits:** https://frosmo.com/multi-armed-bandit-optimization-makes-testing-faster-and-smarter-with-machine-learning/ — Practical MAB optimization
