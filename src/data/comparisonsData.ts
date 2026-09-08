export interface ComparisonFeature {
  name: string;
  category: "ATS Parsing & Scoring" | "Resume Optimization" | "Job Discovery & Workflow" | "Trust & Compliance" | "Pricing & Value";
  ours: {
    supported: boolean;
    label: string;
    detail: string;
  };
  competitor: {
    supported: boolean;
    label: string;
    detail: string;
  };
}

export interface ComparisonFaq {
  question: string;
  answer: string;
}

export interface ComparisonData {
  slug: string;
  competitorName: string;
  competitorLogoText: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  badge: string;
  competitorPricing: string;
  oursPricing: string;
  verdictSummary: string;
  prosOurs: string[];
  prosCompetitor: string[];
  keyDifferences: {
    title: string;
    oursAdvantage: string;
    competitorLimitation: string;
  }[];
  matrix: ComparisonFeature[];
  faqs: ComparisonFaq[];
}

export const COMPARISONS_DATA: Record<string, ComparisonData> = {
  jobscan: {
    slug: "jobscan",
    competitorName: "Jobscan",
    competitorLogoText: "Jobscan",
    title: "Job Tayari vs. Jobscan: Which Actually Tests Real ATS Parsing?",
    subtitle: "Jobscan checks superficial keyword overlap. Job Tayari simulates enterprise ATS parsers (Workday, Greenhouse, Lever, Taleo, iCIMS) and writes reflective, contextual STAR bullets.",
    metaDescription: "Detailed comparison between Job Tayari and Jobscan. Discover why simulated ATS parsing, reflective self-scoring, and zero-signup scans outperform keyword matching.",
    badge: "ATS Optimization Benchmark",
    competitorPricing: "$49.95/month or $89.95/quarter",
    oursPricing: "Free (3/month) · $12/mo Pro · $0/sub Pay-as-you-go",
    verdictSummary: "Jobscan popularized ATS keyword checking, but modern enterprise recruiters have evolved past simple word counting. Jobscan flags missing words, encouraging keyword stuffing that triggers ATS spam filters. Job Tayari simulates the exact structural extraction pipelines of Workday, Greenhouse, and Lever, providing reflective rewrites that ground every skill in measurable STAR achievements.",
    prosOurs: [
      "True multi-engine ATS parser simulation (Workday, Greenhouse, Lever, Taleo, iCIMS)",
      "Reflective multi-pass LLM optimization (scores itself before emitting final text)",
      "Truthfulness gate and keyword stuffing detector to prevent ATS penalties",
      "Instant 60-second magic moment scan without mandatory credit card or trial traps",
      "75% more cost-effective ($12/mo Pro vs $49.95/mo Jobscan)",
    ],
    prosCompetitor: [
      "Established brand name with over a decade in the market",
      "Direct LinkedIn profile optimization tool",
      "Extensive library of legacy ATS articles",
    ],
    keyDifferences: [
      {
        title: "ATS Parser Simulation vs. Static Keyword Counting",
        oursAdvantage: "Simulates Workday, Greenhouse, and Lever token extraction, detecting table corruption, multi-column errors, and unparsed header hazards.",
        competitorLimitation: "Counts word frequency across resume text without testing whether the ATS layout parser will extract experience chunks cleanly.",
      },
      {
        title: "Contextual STAR Rewriting vs. Keyword Stuffing",
        oursAdvantage: "Reflective optimizer weaves missing technical competencies into authentic Problem-Action-Result bullets grounded in your experience.",
        competitorLimitation: "Presents a raw checklist of missing keywords, prompting applicants to force unverified words into their document.",
      },
      {
        title: "Transparent, Honest Pricing",
        oursAdvantage: "Generous free tier (3 optimizations/month) with transparent $12/month Pro tier and pay-as-you-go credit options.",
        competitorLimitation: "Restricted free tier with aggressive trial traps billing $49.95/month upon expiration.",
      },
    ],
    matrix: [
      {
        name: "Workday / Greenhouse / Lever Parser Simulation",
        category: "ATS Parsing & Scoring",
        ours: { supported: true, label: "Full Simulation", detail: "Simulates structural AST parsing, contact extraction, and hazard flags." },
        competitor: { supported: false, label: "Keyword Match Only", detail: "Scans for string matches; does not simulate AST extraction." },
      },
      {
        name: "Structural Layout Hazard Detection",
        category: "ATS Parsing & Scoring",
        ours: { supported: true, label: "Built-in", detail: "Detects multi-column tables, graphics, unicode symbols, and header bleed." },
        competitor: { supported: true, label: "Basic Format Checks", detail: "Checks for font sizes and basic file type restrictions." },
      },
      {
        name: "Reflective Multi-Pass AI Optimization",
        category: "Resume Optimization",
        ours: { supported: true, label: "Autonomous Self-Scoring", detail: "Iteratively scores draft quality before emitting the final tailored version." },
        competitor: { supported: false, label: "Manual Suggestions", detail: "Provides bullet rewriter suggestions that must be manually pasted." },
      },
      {
        name: "Truthfulness & Hallucination Guardrails",
        category: "Trust & Compliance",
        ours: { supported: true, label: "Strict Compliance Gate", detail: "Enforces grounding to candidate profile; flags ungrounded skill claims." },
        competitor: { supported: false, label: "None", detail: "Does not cross-reference candidate history for claim validity." },
      },
      {
        name: "Monthly Pricing",
        category: "Pricing & Value",
        ours: { supported: true, label: "$12 / mo", detail: "Unlimited reflective optimizations, cover letters, and roadmap access." },
        competitor: { supported: false, label: "$49.95 / mo", detail: "Billed monthly at $49.95 or quarterly at $89.95." },
      },
    ],
    faqs: [
      {
        question: "Why is simulated ATS parsing better than keyword matching?",
        answer: "Modern ATS platforms like Workday and Lever do not just look for words; they parse documents into structured entities (Job Title, Employer, Duration, Responsibilities). If a resume uses tables or multi-column layouts, the text is extracted as scrambled tokens. Job Tayari tests this exact parsing behavior before you apply.",
      },
      {
        question: "Can I use Job Tayari for free without entering a credit card?",
        answer: "Yes. Job Tayari offers a 100% free ATS scan with no account creation required, plus 3 free full AI resume optimizations every month.",
      },
      {
        question: "How does Job Tayari prevent keyword stuffing penalties?",
        answer: "Job Tayari includes an automated keyword-stuffing heuristic that measures keyword density and semantic placement. If a skill is added without qualifying context or exceeds natural frequency, Job Tayari flags it before you download.",
      },
    ],
  },
  teal: {
    slug: "teal",
    competitorName: "Teal",
    competitorLogoText: "Teal",
    title: "Job Tayari vs. Teal: Why We Don't Make You Build a CRM",
    subtitle: "Teal requires hours of manual job tracking setup. Job Tayari provides immediate, 60-second time-to-value with reflective resume tailoring and keyless job discovery.",
    metaDescription: "Compare Job Tayari and Teal. See why active job seekers prefer Job Tayari's rapid 60-second magic moment, career knowledge graph, and direct ATS scraping.",
    badge: "Job Search & CRM Comparison",
    competitorPricing: "Free limited / $29/month (Teal+)",
    oursPricing: "Free (3/month) · $12/mo Pro · $49 Team",
    verdictSummary: "Teal is designed as a personal job search CRM with extensive manual board management and tracking columns. While useful for high-level organization, Teal requires significant manual configuration before delivering tailored resume insights. Job Tayari eliminates onboarding friction with an immediate 60-second magic moment that analyzes gaps and tailors resumes instantly, backed by direct Hermes ATS scraping.",
    prosOurs: [
      "Instant 60-second time-to-value without complex CRM onboarding",
      "Direct Tier A keyless ATS scraping (Greenhouse, Lever, Ashby, Workday) with zero stale aggregations",
      "Automated career knowledge graph that preserves ground-truth accomplishments",
      "Transparent pricing at $12/month vs $29/month Teal+",
      "Loss-aversion readiness visualization mapped to specific tech roles",
    ],
    prosCompetitor: [
      "Polished Chrome extension for bookmarking jobs across 50+ boards",
      "Large marketing community and career webinars",
      "Comprehensive manual job tracking pipeline columns",
    ],
    keyDifferences: [
      {
        title: "Fast Time-to-Value vs. Complex CRM Setup",
        oursAdvantage: "Upload your resume, paste a role URL, and receive an actionable match score with reflective rewrites in under 60 seconds.",
        competitorLimitation: "Requires setting up work trackers, chrome permissions, and profile configurations before optimizing.",
      },
      {
        title: "Direct Verified Postings vs. Aggregated Stale Listings",
        oursAdvantage: "Hermes scraping hits direct ATS JSON feeds at the company domain, ensuring every role is actively hiring and open.",
        competitorLimitation: "Relies heavily on third-party aggregators and manual bookmarking where postings are often expired.",
      },
      {
        title: "Knowledge Graph Extraction vs. Static Flat Skills",
        oursAdvantage: "Extracts an interconnected graph connecting projects, tools, metrics, and seniority to target roadmap milestones.",
        competitorLimitation: "Maintains isolated skill tags without semantic relationship mapping or prerequisite roadmaps.",
      },
    ],
    matrix: [
      {
        name: "Time to First Optimized Resume",
        category: "Job Discovery & Workflow",
        ours: { supported: true, label: "< 60 Seconds", detail: "Instant intake with presets or direct PDF upload." },
        competitor: { supported: false, label: "15–30 Minutes", detail: "Requires account onboarding, extension install, and tracker setup." },
      },
      {
        name: "Direct Keyless ATS Job Scraping",
        category: "Job Discovery & Workflow",
        ours: { supported: true, label: "4-Tier Hermes Engine", detail: "Bypasses stale boards by reading direct Greenhouse/Lever/Ashby endpoints." },
        competitor: { supported: false, label: "Extension Bookmarking", detail: "Job discovery relies on user manual capture or aggregated listings." },
      },
      {
        name: "Career Knowledge Graph",
        category: "Resume Optimization",
        ours: { supported: true, label: "Full Graph Extraction", detail: "Tracks competency relationships, project provenance, and target role readiness." },
        competitor: { supported: false, label: "Flat Skills List", detail: "Basic skill checklist without semantic dependency mapping." },
      },
      {
        name: "Weekly Job Match Digest",
        category: "Job Discovery & Workflow",
        ours: { supported: true, label: "Hermes Automated Digest", detail: "Curates top 3 verified matches each week based on your graph profile." },
        competitor: { supported: true, label: "General Email Digest", detail: "Sends general email updates based on saved searches." },
      },
      {
        name: "Monthly Pro Price",
        category: "Pricing & Value",
        ours: { supported: true, label: "$12 / mo", detail: "Full access to reflective optimization and roadmap tools." },
        competitor: { supported: false, label: "$29 / mo", detail: "Teal+ subscription billed at $29/mo or $79/quarter." },
      },
    ],
    faqs: [
      {
        question: "Is Job Tayari an alternative to Teal?",
        answer: "Yes. Job Tayari provides both job tracking and resume tailoring, but focuses on deep algorithmic optimization and rapid execution rather than tedious manual CRM management.",
      },
      {
        question: "How does Job Tayari avoid the stale job listing problem?",
        answer: "Job Tayari's Hermes engine scrapes primary career portals (like company.greenhouse.io or jobs.lever.co) directly via keyless JSON feeds. Closed requisitions disappear instantly from our index.",
      },
      {
        question: "Can I track my job applications in Job Tayari?",
        answer: "Yes. Job Tayari includes an intuitive Kanban board for tracking applications from Saved to Review, Applied, Interviewing, and Offer, complete with milestone celebrations.",
      },
    ],
  },
  simplify: {
    slug: "simplify",
    competitorName: "Simplify",
    competitorLogoText: "Simplify Copilot",
    title: "Job Tayari vs. Simplify: Speed vs. Strategy",
    subtitle: "Simplify automates form filling for volume applications. Job Tayari optimizes candidate-to-ATS fit, eliminating low-quality spray-and-pray rejections.",
    metaDescription: "Compare Job Tayari and Simplify Copilot. Understand the difference between automated form autofill and strategic ATS parser simulation with tailored STAR bullets.",
    badge: "Auto-Apply & Optimization Analysis",
    competitorPricing: "Free extension / $39.99/month Pro",
    oursPricing: "Free (3/month) · $12/mo Pro",
    verdictSummary: "Simplify has achieved strong distribution with its Chrome extension autofill for standard ATS job applications. However, autofilling 200 generic applications creates a 'spray-and-pray' dynamic that leads to high rejection rates. Job Tayari combines high-accuracy ATS parser simulation with reflective resume tailoring and human-in-the-loop application safety, ensuring that every submission has a high likelihood of recruiter engagement.",
    prosOurs: [
      "Deep ATS parser simulation for Workday, Greenhouse, and Lever",
      "Reflective STAR bullet tailoring that matches specific requisition criteria",
      "Strict Human-in-the-Loop (HITL) compliance with cryptographic receipts",
      "Prevents candidate blacklisting caused by unverified bulk submission bots",
      "Pro plan at $12/mo compared to Simplify's $39.99/mo AI tier",
    ],
    prosCompetitor: [
      "1M+ Chrome Web Store installs with polished autofill on 100+ ATS platforms",
      "Very fast application form completion for entry-level and internship roles",
      "Active student and early-career user community",
    ],
    keyDifferences: [
      {
        title: "Quality-First Fit vs. Quantity 'Spray-and-Pray'",
        oursAdvantage: "Ensures your resume achieves an 85%+ ATS parser match rate before applying, dramatically improving interview conversion.",
        competitorLimitation: "Encourages submitting identical generic resumes to hundreds of companies, leading to algorithmic filtering.",
      },
      {
        title: "ATS Parser Testing vs. Keyword Overlap",
        oursAdvantage: "Tests whether Workday or Lever's resume parser extracts work experience cleanly without corrupting dates or titles.",
        competitorLimitation: "Provides simple match scores without testing how the target ATS parser handles your file formatting.",
      },
      {
        title: "Human-in-the-Loop Safety vs. Autonomous Risk",
        oursAdvantage: "Candidate confirms every sensitive answer (work authorization, salary, declarations) with durable auditability.",
        competitorLimitation: "Automated filling can submit outdated or hallucinated answers to critical legal and authorization questions.",
      },
    ],
    matrix: [
      {
        name: "ATS Parser Simulation",
        category: "ATS Parsing & Scoring",
        ours: { supported: true, label: "Workday / Greenhouse / Lever", detail: "Deep structural validation and token fidelity analysis." },
        competitor: { supported: false, label: "None", detail: "Autofills form fields without verifying parser extraction fidelity." },
      },
      {
        name: "Reflective Tailoring Engine",
        category: "Resume Optimization",
        ours: { supported: true, label: "Multi-Pass STAR Rewrites", detail: "Tailors achievements to match requisition requirements contextually." },
        competitor: { supported: false, label: "Basic Rewriter", detail: "Limited bullet points rewrites in premium tier." },
      },
      {
        name: "Application Submission Proof",
        category: "Trust & Compliance",
        ours: { supported: true, label: "Cryptographic Receipt", detail: "Generates SHA-256 verifiable candidate confirmation receipt." },
        competitor: { supported: false, label: "Basic Tracker", detail: "Logs submission URL without cryptographic audit trail." },
      },
      {
        name: "Browser Extension",
        category: "Job Discovery & Workflow",
        ours: { supported: true, label: "Manifest V3 Extension", detail: "Connects web session to local application bridge." },
        competitor: { supported: true, label: "Dominant Extension", detail: "Extensive field detection on 100+ ATS portals." },
      },
      {
        name: "Pro Pricing",
        category: "Pricing & Value",
        ours: { supported: true, label: "$12 / mo", detail: "Affordable pro access for all knowledge workers." },
        competitor: { supported: false, label: "$39.99 / mo", detail: "AI Copilot Pro billed at $39.99/month." },
      },
    ],
    faqs: [
      {
        question: "Can I use Job Tayari alongside Simplify?",
        answer: "Yes. Many candidates use Job Tayari to simulate ATS parsing and generate the perfectly tailored resume, then use an autofill tool to submit the application.",
      },
      {
        question: "Why does Job Tayari enforce Human-in-the-Loop verification?",
        answer: "Recruiters and corporate ATS systems increasingly detect and blacklist autonomous bots that submit hallucinated salary, legal, and authorization data. Job Tayari's durable handoff ensures you remain compliant.",
      },
      {
        question: "Does Job Tayari offer an extension for application autofill?",
        answer: "Yes. Job Tayari includes a Manifest V3 browser extension that bridges candidate answers and resumes directly to live application forms.",
      },
    ],
  },
  rezi: {
    slug: "rezi",
    competitorName: "Rezi",
    competitorLogoText: "Rezi",
    title: "Job Tayari vs. Rezi: True ATS Simulation vs. Static Templates",
    subtitle: "Rezi provides clean static templates. Job Tayari delivers multi-engine ATS parser simulations, Hermes direct job matching, and career readiness roadmaps.",
    metaDescription: "Compare Job Tayari and Rezi. Learn why candidates choose Job Tayari's live ATS parser testing, reflective STAR tailoring, and skill gap roadmaps over static resume builders.",
    badge: "Resume Builder Comparison",
    competitorPricing: "$29/month or $149 Lifetime",
    oursPricing: "Free (3/month) · $12/mo Pro",
    verdictSummary: "Rezi is a respected bootstrapped tool known for clean, single-column ATS resume templates. However, Rezi operates primarily as a traditional document editor with static AI prompts. Job Tayari is an application infrastructure layer that integrates live ATS parser simulation, direct Hermes job discovery, and a career knowledge graph that tracks long-term skill progression.",
    prosOurs: [
      "Simulates live Workday, Greenhouse, and Lever document extraction pipelines",
      "Dynamic job description tailoring with reflective multi-pass scoring",
      "Integrated Hermes job search engine with direct keyless career page feeds",
      "Target role readiness scoring (e.g., 73% Senior PM) with curated course recommendations",
      "Significantly lower monthly cost ($12/mo vs $29/mo Rezi)",
    ],
    prosCompetitor: [
      "Lifetime purchase option ($149 lifetime deal)",
      "Strict typographic layout rules adhering to standard ATS margins",
      "Export to multiple file formats including DOCX and PDF",
    ],
    keyDifferences: [
      {
        title: "Live ATS Simulation vs. Static Layout Guarantees",
        oursAdvantage: "Tests your resume against actual ATS parser behavioral models to detect parsing corruption before you apply.",
        competitorLimitation: "Relies on standard layout rules without testing how individual ATS engines tokenize the text.",
      },
      {
        title: "Integrated Job Discovery vs. Document-Only Scope",
        oursAdvantage: "Combines resume tailoring with verified Hermes job discovery, weekly job match digests, and Kanban tracking.",
        competitorLimitation: "Strictly a document builder with no native job search or direct ATS scraping engine.",
      },
      {
        title: "Career Roadmap & Skill Gap Resolution",
        oursAdvantage: "Maps missing skills to concrete learning resources and target role progression milestones.",
        competitorLimitation: "Only focuses on the current resume document without continuous career intelligence.",
      },
    ],
    matrix: [
      {
        name: "ATS Parser Simulation",
        category: "ATS Parsing & Scoring",
        ours: { supported: true, label: "Workday / Greenhouse / Lever", detail: "Simulates parser behavior across leading enterprise ATS engines." },
        competitor: { supported: false, label: "Static Formatting", detail: "Formats documents using clean single-column rules without engine-specific tests." },
      },
      {
        name: "Hermes Direct Job Search",
        category: "Job Discovery & Workflow",
        ours: { supported: true, label: "Integrated Keyless Engine", detail: "Scrapes verified career pages with zero stale aggregator listings." },
        competitor: { supported: false, label: "External Only", detail: "No integrated job search; users must source openings independently from job boards." },
      },
      {
        name: "Career Roadmap & Readiness",
        category: "Resume Optimization",
        ours: { supported: true, label: "Role Readiness Radar", detail: "Calculates candidate readiness percentage and identifies critical skill gaps." },
        competitor: { supported: false, label: "None", detail: "Scope is limited to individual document editing." },
      },
      {
        name: "Typst High-Fidelity PDF Export",
        category: "Resume Optimization",
        ours: { supported: true, label: "Typst Engine", detail: "Renders micro-typography with mathematical layout precision." },
        competitor: { supported: true, label: "Standard PDF", detail: "Generates clean standard ATS PDFs." },
      },
      {
        name: "Monthly Subscription",
        category: "Pricing & Value",
        ours: { supported: true, label: "$12 / mo", detail: "Affordable recurring plan with full feature set." },
        competitor: { supported: false, label: "$29 / mo", detail: "Monthly subscription or $149 one-time payment." },
      },
    ],
    faqs: [
      {
        question: "Does Job Tayari support ATS-friendly formatting like Rezi?",
        answer: "Yes. Job Tayari resumes are formatted to strictly adhere to single-column ATS requirements, and can be exported via Typst or standard DOCX with zero unparseable layout hazards.",
      },
      {
        question: "Can I optimize multiple resumes for different target roles?",
        answer: "Yes. Job Tayari allows you to maintain multiple tailored variants linked to your central Career Knowledge Graph.",
      },
      {
        question: "How does Job Tayari help me beyond writing a resume?",
        answer: "Job Tayari supports your entire career journey: finding direct verified jobs, analyzing ATS fit, tracking applications, preparing for technical interviews, and navigating salary negotiations.",
      },
    ],
  },
};

export function getComparisonBySlug(slug: string): ComparisonData | undefined {
  return COMPARISONS_DATA[slug.toLowerCase()];
}

export function getAllComparisons(): ComparisonData[] {
  return Object.values(COMPARISONS_DATA);
}
