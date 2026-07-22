/**
 * SIMPLE CONFIGURATION
 * Control everything from here.
 */
const CONFIG = {
  // 'auto': Detects Production on tayari-skill-boost.lovable.app
  // 'production': Force Production mode
  // 'preview': Force Preview mode
  mode: 'auto' as 'auto' | 'production' | 'preview',

  // Feature Toggles
  // Key: Feature Name
  // Value: [ ProductionEnabled, PreviewEnabled ]
  features: {
    // Feature flags control visibility and behavior of major app sections.
    // Each entry: [ ProductionEnabled, PreviewEnabled ]
    // Set true to enable, false to disable for the given environment.

    // Resume optimizer UI, accessible in both prod and preview
    resumeOptimizer: [true, true],
    // Career roadmap visual planning tool
    careerRoadmap: [true, true],
    // Interactive interview preparation module
    interviewPrep: [true, true],
    // Job search interface and autopilot integration
    jobSearch: [true, true],
    // Blog content section
    blog: [true, true],
    // Pricing page and subscription info
    pricing: [true, true],
    // Careers page (currently preview only)
    careers: [false, true],
    // Help/FAQ section (preview only)
    help: [false, true],
    // Cover letter generator
    coverLetter: [true, true],
    // Communication hub for messaging templates
    communicationHub: [true, true],
    // AI-powered interview coaching
    interviewAI: [true, true],
    // Voice interview coach with live metrics
    voiceCoach: [true, true],
    // Salary negotiation copilot with H1B benchmarks
    negotiationCopilot: [true, true],
    // 15-minute Company Radar Job Sentinel
    companyRadar: [true, true],
    // Skill gap radar with free learning resources
    skillGapRadar: [true, true],
    // AI interactive portfolio site generator
    portfolioGenerator: [true, true],
    // Recruiter cold email & LinkedIn note copilot
    recruiterOutreach: [true, true],
    // Application conversion funnel analytics
    funnelAnalytics: [true, true],
    // Browser extension availability (disabled by default)
    browserExtension: [false, false],
    // Knowledge hub for resume knowledge graph
    knowledgeHub: [true, true],
    // Career operations dashboard
    careerOps: [true, true],
  },

  // Navigation Links
  // { label, href, feature (matches key above or null) }
  // Navigation links are filtered based on feature flags above.
  links: [
    { label: "Home", href: "/", feature: null },
    { label: "Resume Optimizer", href: "/resume", feature: "resumeOptimizer" },
    { label: "Career Roadmap", href: "/roadmap", feature: "careerRoadmap" },
    { label: "Knowledge Hub", href: "/knowledge-hub", feature: "knowledgeHub" },
    { label: "Interview Board", href: "/interview", feature: "interviewPrep" },
    { label: "Interview Prep", href: "/interview/prep", feature: "interviewAI" },
    { label: "Job Search", href: "/jobs", feature: "jobSearch" },
    { label: "Apply Assist", href: "/jobs/autopilot", feature: "jobSearch" },
    { label: "Cover Letter", href: "/cover-letter", feature: "coverLetter" },
    { label: "Communication", href: "/communication", feature: "communicationHub" },
    { label: "Career-Ops", href: "/career-ops", feature: "careerOps" },
    { label: "Career Intelligence", href: "/career-intelligence", feature: "careerOps" },
    { label: "Blog", href: "/blog", feature: "blog" },
    { label: "Pricing", href: "/pricing", feature: "pricing" },
    { label: "FAQ", href: "/faq", feature: null },
    { label: "Contact", href: "/contact", feature: null },
  ]
};

// ============================================
// SYSTEM LOGIC (No need to edit below)
// ============================================

const isProd = (() => {
  if (CONFIG.mode === 'production') return true;
  if (CONFIG.mode === 'preview') return false;
  return typeof window !== 'undefined' && window.location.hostname === "tayari-skill-boost.lovable.app";
})();

export const isProductionMode = isProd;

const check = (feature: keyof typeof CONFIG.features): boolean => {
  return isProd ? CONFIG.features[feature][0] : CONFIG.features[feature][1];
};

// Dynamically generate feature flags
// Use this in App.tsx like: features.interviewPrep
export const features = Object.keys(CONFIG.features).reduce((acc, key) => {
  acc[key as keyof typeof CONFIG.features] = check(key as keyof typeof CONFIG.features);
  return acc;
}, {} as Record<keyof typeof CONFIG.features, boolean>);

// Global UI Settings
export const settings = {
  showFullProductsSection: features.interviewPrep,
  showComingSoonBadges: true,
  showFullFooter: true,
  enableAllRoutes: true,
} as const;

export const getNavLinks = () => {
  return CONFIG.links.filter(link => {
    if (!link.feature) return true;
    // @ts-ignore
    return features[link.feature];
  }).map(l => ({ label: l.label, href: l.href }));
};
