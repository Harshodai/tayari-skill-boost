// Feature flags based on URL/environment
// Preview URL: Full UI with all features
// Production URL: Resume Optimizer only (focused, conversion-optimized)

const getIsProduction = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === "tayari-skill-boost.lovable.app";
};

export const isProductionMode = getIsProduction();

export const FEATURE_FLAGS = {
  // Navigation features
  showInterviewPrep: !isProductionMode,
  showJobSearch: !isProductionMode,
  showBlog: !isProductionMode,
  showPricing: !isProductionMode,
  showCareers: !isProductionMode,
  showHelp: !isProductionMode,
  
  // Landing page sections
  showFullProductsSection: !isProductionMode,
  showComingSoonBadges: !isProductionMode,
  
  // Footer
  showFullFooter: !isProductionMode,
  
  // Routes
  enableAllRoutes: !isProductionMode,
} as const;

// Navigation links for production (minimal, focused)
export const PRODUCTION_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/resume-upload", label: "Resume Optimizer" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

// Navigation links for preview (full features)
export const PREVIEW_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/resume-upload", label: "Resume Optimizer" },
  { href: "/interview-coming-soon", label: "Interview Prep" },
  { href: "/jobs-coming-soon", label: "Job Search" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
];

// Get the appropriate nav links based on environment
export const getNavLinks = () => {
  return isProductionMode ? PRODUCTION_NAV_LINKS : PREVIEW_NAV_LINKS;
};
