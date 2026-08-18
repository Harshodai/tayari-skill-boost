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
    // Interactive interview preparation module (disabled for current release scope)
    interviewPrep: [false, false],
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
    // Google Workspace Calendar connector; disabled until provider evidence is complete
    googleCalendar: [false, false],
    // Google Workspace Drive connector; disabled until provider evidence is complete
    googleDrive: [false, false],
    // Durable automation workspace; disabled until runtime and provider evidence gates pass
    automationControl: [false, false],
    // AI-powered interview coaching (disabled for current release scope)
    interviewAI: [false, false],
    // Voice interview coach with live metrics
    voiceCoach: [false, false],
    // Salary negotiation copilot with H1B benchmarks
    negotiationCopilot: [true, true],
    // 15-minute Company Radar Job Sentinel
    companyRadar: [true, true],
    // AI interactive portfolio site generator
    portfolioGenerator: [true, true],
    // Browser extension availability (enabled)
    browserExtension: [true, true],
    // JobTayari Computer is preview/staging-only until live isolation and takeover evidence exists.
    computerControl: [false, true],
    // JobTayari Desktop task surface is preview/staging-only until persistent-worker evidence exists.
    desktopAgent: [false, true],
    // Knowledge hub for resume knowledge graph
    knowledgeHub: [true, true],
    // Career operations dashboard
    careerOps: [true, true],
    // One-Shot Autopilot Console
    oneShotPipeline: [true, true],
    // Typst ATS Resume Studio
    typstStudio: [true, true],
    // Candidate Answer Bank for Auto-Fill
    candidateAnswerBank: [true, true],
    // Agent-Reach Content & Social Extractor
    agentReach: [true, true],
    // Verified-Human badge (truth + screening checks)
    verification: [true, true],
    // Personalized referral-draft engine (Moat-1)
    referralDrafts: [true, true],
  },


  // Navigation Links
  // { label, href, feature (matches key above or null) }
  // Navigation links are filtered based on feature flags above.
  links: [
    { label: "Home", href: "/", feature: null },
    { label: "One-Shot Console", href: "/one-shot", feature: "oneShotPipeline" },
    { label: "Content Extractor", href: "/agent-reach", feature: "agentReach" },
    { label: "Typst Resume Studio", href: "/typst-studio", feature: "typstStudio" },
    { label: "Answer Bank", href: "/answer-bank", feature: "candidateAnswerBank" },
    { label: "Resume Optimizer", href: "/resume", feature: "resumeOptimizer" },
    { label: "Career Roadmap", href: "/roadmap", feature: "careerRoadmap" },
    { label: "Knowledge Hub", href: "/knowledge-hub", feature: "knowledgeHub" },

    { label: "Job Search", href: "/jobs", feature: "jobSearch" },
    { label: "AutoPilot", href: "/jobs/autopilot", feature: "jobSearch" },
    { label: "Cover Letter", href: "/cover-letter", feature: "coverLetter" },
    { label: "Communication", href: "/communication", feature: "communicationHub" },
    { label: "Career-Ops", href: "/career-ops", feature: "careerOps" },
    { label: "Career Intelligence", href: "/career-intelligence", feature: "careerOps" },
    { label: "Computer Control", href: "/control-room", feature: "computerControl" },
    { label: "Desktop Agent", href: "/desktop", feature: "desktopAgent" },
    { label: "Automation Workspace", href: "/automations", feature: "automationControl" },
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
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // Anything that isn't a local dev host or a hosted preview sandbox is treated
  // as production, so custom domains work without a code change.
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const isPreviewSandbox = host.startsWith('id-preview--') || host.endsWith('.lovableproject.com');
  return !isLocal && !isPreviewSandbox;
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
  const featureMap = features as unknown as Record<string, boolean | undefined>;
  return CONFIG.links.filter(link => {
    if (!link.feature) return true;
    // CONFIG.links may reference a feature key this build's feature set
    // doesn't define; unknown features are disabled.
    return featureMap[link.feature] ?? false;
  }).map(l => ({ label: l.label, href: l.href }));
};
