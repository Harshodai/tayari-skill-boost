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
    interviewPrep: [true, true],
    jobSearch: [true, true],
    blog: [true, true],
    pricing: [false, false],
    careers: [false, true],
    help: [false, true],
  },

  // Navigation Links
  // { label, href, feature (matches key above or null) }
  links: [
    { label: "Home", href: "/", feature: null },
    { label: "Resume Optimizer", href: "/resume", feature: null },
    { label: "Interview Prep", href: "/interview", feature: "interviewPrep" },
    { label: "Job Search", href: "/jobs", feature: "jobSearch" },
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
  showComingSoonBadges: !isProd,
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
