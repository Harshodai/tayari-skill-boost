-- Blog posts table with success stories support
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  featured_image TEXT,
  category TEXT NOT NULL CHECK (category IN ('resume-tips', 'interview-prep', 'career-tips', 'success-stories')),
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  is_success_story BOOLEAN DEFAULT FALSE,
  prompts_used JSONB,
  outcomes JSONB,
  author_name TEXT DEFAULT 'Tayari Team',
  read_time_minutes INTEGER DEFAULT 5,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public read access for published posts
CREATE POLICY "Anyone can read published blog posts"
ON public.blog_posts
FOR SELECT
USING (published_at IS NOT NULL AND published_at <= NOW());

-- Index for category filtering
CREATE INDEX idx_blog_posts_category ON public.blog_posts(category);

-- Index for slug lookup
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);

-- Index for featured posts
CREATE INDEX idx_blog_posts_featured ON public.blog_posts(is_featured) WHERE is_featured = true;

-- Index for published posts sorted by date
CREATE INDEX idx_blog_posts_published ON public.blog_posts(published_at DESC) WHERE published_at IS NOT NULL;

-- Update timestamp trigger
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- User achievements table for gamification
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('first_analysis', 'score_improver', 'perfect_score', 'streak_3', 'streak_7', 'template_explorer', 'early_adopter')),
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(user_id, achievement_type)
);

-- Enable RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can view their own achievements
CREATE POLICY "Users can view own achievements"
ON public.user_achievements
FOR SELECT
USING (auth.uid() = user_id);

-- User activity streaks table
CREATE TABLE public.user_streaks (
  user_id UUID PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- Users can view their own streaks
CREATE POLICY "Users can view own streaks"
ON public.user_streaks
FOR SELECT
USING (auth.uid() = user_id);

-- Seed initial blog posts with success stories
INSERT INTO public.blog_posts (title, slug, excerpt, content, category, tags, is_featured, is_success_story, prompts_used, outcomes, author_name, read_time_minutes, published_at) VALUES
(
  'How Sarah Landed Her Dream Job at Google with a 95 Score',
  'sarah-google-success-story',
  'From a 62 to a 95 resume score - Sarah shares her journey and the exact prompts that helped her land a Senior Engineer role.',
  '# From Rejection to Google: My Resume Transformation Journey

When I first uploaded my resume to Tayari, I got a score of 62. Honestly, I was devastated. I had spent years building my skills, but my resume was not telling that story.

## The Key Changes

### 1. Quantifying Achievements
My old resume said: "Improved system performance"
My new resume says: "Reduced API response time by 73%, saving $2.4M annually"

### 2. Tailoring for ATS
I learned that my resume was getting filtered out before humans ever saw it. Tayari helped me identify the exact keywords I was missing.

### 3. Structure Matters
The Tech template helped me showcase my projects in a way that resonated with technical recruiters.

## The Results

Within 3 weeks of implementing these changes:
- 4x increase in callback rate
- 3 final-round interviews
- 2 offers, including Google!

## My Advice

Do not just list your responsibilities. Every bullet point should answer: "So what? Why does this matter?"',
  'success-stories',
  ARRAY['google', 'software-engineer', 'ats-optimization', 'quantification'],
  TRUE,
  TRUE,
  '[{"prompt": "Emphasize quantifiable achievements and metrics", "purpose": "Transform vague statements into impactful results", "result": "Every bullet point now includes specific numbers and business impact"}, {"prompt": "Optimize for ATS with job-specific keywords", "purpose": "Ensure resume passes automated screening", "result": "Added 15 relevant keywords that were missing"}]',
  '{"before_score": 62, "after_score": 95, "interviews_landed": 5, "offers_received": 2, "time_to_offer": "3 weeks"}',
  'Sarah M.',
  8,
  NOW()
),
(
  '10 Resume Mistakes That Are Costing You Interviews',
  '10-resume-mistakes-costing-interviews',
  'Learn the most common resume errors that silently kill your chances and how to fix them today.',
  '# 10 Resume Mistakes That Are Costing You Interviews

After analyzing over 50,000 resumes, we have identified the top mistakes that prevent qualified candidates from getting interviews.

## 1. Using a Generic Objective Statement

**Bad:** "Seeking a challenging position where I can utilize my skills"
**Good:** "Senior Backend Engineer specializing in distributed systems, seeking to scale fintech infrastructure at [Company]"

## 2. Missing Quantifiable Results

Recruiters spend 6-7 seconds on your resume. Numbers pop. Use them.

## 3. Poor ATS Formatting

Fancy templates look great but often fail ATS parsing. Stick to clean, structured formats.

## 4. Burying Key Information

Your most impressive achievements should be in the top third of your resume.

## 5. Using Passive Language

"Was responsible for" vs "Led" - active verbs make you sound like a leader.

## 6. Including Irrelevant Experience

That summer job from 10 years ago? Unless it is relevant, remove it.

## 7. Typos and Grammar Errors

58% of hiring managers reject resumes with typos. Proofread!

## 8. Missing Keywords

Each job posting has specific keywords. Mirror them in your resume.

## 9. Too Long or Too Short

1-2 pages is the sweet spot. Entry level: 1 page. Senior: 2 pages max.

## 10. No Call to Action

Make it easy to contact you. Include LinkedIn, portfolio, and email prominently.',
  'resume-tips',
  ARRAY['resume-tips', 'common-mistakes', 'ats', 'formatting'],
  FALSE,
  FALSE,
  NULL,
  NULL,
  'Tayari Team',
  6,
  NOW()
),
(
  'The Complete Guide to ATS-Friendly Resumes in 2025',
  'ats-friendly-resumes-guide-2025',
  'Master the art of creating resumes that pass Applicant Tracking Systems while impressing human recruiters.',
  '# The Complete Guide to ATS-Friendly Resumes in 2025

75% of resumes are rejected by ATS before a human ever sees them. Here is how to beat the bots.

## What is an ATS?

Applicant Tracking Systems are software that companies use to filter, sort, and rank resumes. Think of it as the gatekeeper to your dream job.

## Key ATS Optimization Strategies

### 1. Use Standard Section Headers
- Work Experience (not "Career Journey")
- Education (not "Learning Path")
- Skills (not "Superpowers")

### 2. Include Keywords from the Job Description

ATS systems score resumes based on keyword matches. Read the job posting carefully and mirror the language.

### 3. Avoid Tables and Graphics

Most ATS cannot parse tables, columns, or images. Keep formatting simple.

### 4. Use Standard Fonts

Arial, Calibri, and Times New Roman are safe choices.

### 5. Save as .docx or PDF

Most ATS prefer .docx, but PDF is usually safe. Avoid .pages or Google Docs links.

## Pro Tips

- Use Tayari to check your ATS compatibility score
- Test your resume by copying text - if it comes out jumbled, ATS will struggle
- Include both spelled-out terms and acronyms (e.g., "Search Engine Optimization (SEO)")',
  'resume-tips',
  ARRAY['ats', 'optimization', 'keywords', '2025-guide'],
  FALSE,
  FALSE,
  NULL,
  NULL,
  'Tayari Team',
  10,
  NOW()
),
(
  'From Layoff to 150% Salary Increase: Mike Career Pivot Story',
  'mike-career-pivot-success-story',
  'After being laid off, Mike used Tayari to pivot from marketing to product management and tripled his interview rate.',
  '# From Marketing to Product: My Unexpected Career Pivot

When my company announced layoffs in March 2024, I saw it as an opportunity rather than a setback. I had always been interested in product management, but my resume screamed "marketer."

## The Challenge

My marketing resume got a Tayari score of 71 for PM roles. The analysis showed I had relevant skills but was not presenting them effectively for product roles.

## The Transformation Strategy

### Reframing Experience

Instead of "Managed email marketing campaigns," I wrote "Drove product decisions using A/B testing and user behavior data, increasing conversion by 45%"

### Highlighting Transferable Skills

- Data analysis
- User research
- Cross-functional collaboration
- Stakeholder management

### Using the Right Template

I chose the Professional template to convey business acumen rather than creative flair.

## The Prompts That Worked

1. "Translate marketing achievements into product-focused language"
2. "Emphasize data-driven decision making and metrics"
3. "Highlight cross-functional leadership experience"

## Results

My optimized resume scored 89 for PM roles. Within 6 weeks:
- Landed 12 interviews
- Received 3 offers
- Accepted a Senior PM role with 150% salary increase

## Key Takeaway

Your skills are more transferable than you think. The key is presenting them in the language your target industry understands.',
  'success-stories',
  ARRAY['career-change', 'product-management', 'layoff', 'salary-increase'],
  FALSE,
  TRUE,
  '[{"prompt": "Translate marketing achievements into product-focused language", "purpose": "Reframe experience for PM roles", "result": "Marketing metrics became product impact stories"}, {"prompt": "Emphasize data-driven decision making", "purpose": "Show analytical capabilities", "result": "Highlighted 8 instances of data-informed decisions"}, {"prompt": "Highlight cross-functional leadership", "purpose": "Demonstrate PM soft skills", "result": "Added collaboration examples with eng, design, sales"}]',
  '{"before_score": 71, "after_score": 89, "interviews_landed": 12, "offers_received": 3, "time_to_offer": "6 weeks", "salary_increase": "150%"}',
  'Mike T.',
  7,
  NOW()
),
(
  'Mastering the STAR Method for Resume Bullet Points',
  'star-method-resume-bullet-points',
  'Transform weak resume bullets into compelling stories using the STAR framework that hiring managers love.',
  '# Mastering the STAR Method for Resume Bullet Points

The STAR method is not just for interviews. It is the secret weapon for writing resume bullets that get callbacks.

## What is STAR?

- **S**ituation: The context
- **T**ask: Your responsibility
- **A**ction: What you did
- **R**esult: The measurable outcome

## Before and After Examples

### Example 1: Software Engineer

**Before:** "Worked on the checkout system"

**After:** "Redesigned checkout flow (S/T), implementing lazy loading and code splitting (A), reducing page load time by 60% and increasing conversion by 23% (R)"

### Example 2: Marketing Manager

**Before:** "Managed social media accounts"

**After:** "Took over underperforming social channels (S/T), developed data-driven content strategy with influencer partnerships (A), growing followers from 10K to 250K and driving $1.2M in attributed revenue (R)"

### Example 3: Project Manager

**Before:** "Led project teams"

**After:** "Led cross-functional team of 12 through company largest product launch (S/T), implementing agile ceremonies and risk mitigation (A), delivering 2 weeks early and $500K under budget (R)"

## Pro Tips

1. Start bullets with strong action verbs
2. Always include at least one number
3. Focus on business impact, not just activity
4. Use Tayari Quantify achievements prompt to help

## Common Mistakes

- Being too vague about results
- Including too much context
- Forgetting the "so what"',
  'resume-tips',
  ARRAY['star-method', 'bullet-points', 'writing-tips', 'examples'],
  FALSE,
  FALSE,
  NULL,
  NULL,
  'Tayari Team',
  5,
  NOW()
),
(
  'Interview Prep: Questions to Expect Based on Your Resume',
  'interview-questions-based-on-resume',
  'Predict and prepare for interview questions by analyzing your resume through the interviewer eyes.',
  '# Interview Questions to Expect Based on Your Resume

Every bullet point on your resume is a potential interview question. Here is how to prepare.

## The Resume-to-Interview Pipeline

Interviewers use your resume as a roadmap. They will ask you to elaborate on:

1. Your biggest achievements
2. Gaps in employment
3. Career transitions
4. Technical skills listed
5. Leadership experiences

## For Each Bullet Point, Prepare:

### The Story
- What was the situation?
- What did you specifically do?
- What was the measurable result?
- What did you learn?

### Potential Follow-ups
- "What was the biggest challenge?"
- "What would you do differently?"
- "How did you handle conflict?"
- "What was your specific contribution vs the team?"

## Red Flags Interviewers Look For

1. **Vague claims:** "Improved efficiency" - by how much?
2. **Team-only achievements:** "We launched..." - what did YOU do?
3. **Outdated skills:** Technologies from 5+ years ago
4. **Unexplained gaps:** Address them proactively

## Pro Tip

Use Tayari analysis to identify weak points in your resume. Those are exactly what interviewers will probe.

## Preparation Checklist

- 2-3 stories for each major bullet point
- Specific numbers memorized
- Explanation for any gaps
- Questions about the company ready',
  'interview-prep',
  ARRAY['interview-prep', 'questions', 'preparation', 'strategy'],
  FALSE,
  FALSE,
  NULL,
  NULL,
  'Tayari Team',
  6,
  NOW()
);