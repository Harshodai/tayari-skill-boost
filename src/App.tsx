
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageTransition } from "@/components/layout/PageTransition";
import { features } from "@/config/features";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { ScrollToTopHandler } from "@/components/layout/ScrollToTopHandler";
import { AutomationProvider } from "@/contexts/AutomationContext";
import { ActivityDrawer } from "@/components/automation/ActivityDrawer";
import { useMigrateAutomationRuns } from "@/hooks/useMigrateAutomationRuns";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { LoadingFallback } from "@/components/LoadingFallback";

import { lazy, Suspense } from 'react';
const Index = lazy(() => import('./pages/Index'));

const Onboarding = lazy(() => import('./pages/Onboarding'));
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const PetInsights = lazy(() => import('./pages/PetInsights'));
const Settings = lazy(() => import('./pages/Settings'));
const ResumeUpload = lazy(() => import('./pages/ResumeUpload'));
const ResumeResults = lazy(() => import('./pages/ResumeResults'));
const ResumeTemplates = lazy(() => import('./pages/ResumeTemplates'));
const InterviewBoard = lazy(() => import('./pages/InterviewBoard'));
const JobSearch = lazy(() => import('./pages/JobSearch'));
const AutoPilot = lazy(() => import('./pages/AutoPilot'));
const CareerRoadmap = lazy(() => import('./pages/CareerRoadmap'));
const CareerIntelligence = lazy(() => import('./pages/CareerIntelligence'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Careers = lazy(() => import('./pages/Careers'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Help = lazy(() => import('./pages/Help'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Profile = lazy(() => import('./pages/Profile'));
const CoverLetter = lazy(() => import('./pages/CoverLetter'));
const CommunicationHub = lazy(() => import('./pages/CommunicationHub'));
const InterviewPrep = lazy(() => import('./pages/InterviewPrep'));
const KnowledgeHub = lazy(() => import('./pages/KnowledgeHub'));
const ExtensionOnboarding = lazy(() => import('./pages/ExtensionOnboarding'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const PredictiveAnalytics = lazy(() => import('./pages/PredictiveAnalytics'));
const AdvisorDashboard = lazy(() => import('./pages/AdvisorDashboard'));
const AgentPanel = lazy(() => import('./pages/AgentPanel'));
const APIKeys = lazy(() => import('./pages/APIKeys'));
const ResumeGraph = lazy(() => import('./pages/ResumeGraph'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const FreeAtsScan = lazy(() => import('./pages/FreeAtsScan'));

const CareerOpsDashboard = lazy(() => import('./pages/CareerOpsDashboard'));
const LinkedInImport = lazy(() => import('./pages/LinkedInImport'));
const InterviewVoiceCoach = lazy(() => import('./pages/InterviewVoiceCoach'));
const NegotiationCopilot = lazy(() => import('./pages/NegotiationCopilot'));
const CompanyRadar = lazy(() => import('./pages/CompanyRadar'));
const SkillGapRadar = lazy(() => import('./pages/SkillGapRadar'));
const PortfolioGenerator = lazy(() => import('./pages/PortfolioGenerator'));
const RecruiterOutreach = lazy(() => import('./pages/RecruiterOutreach'));
const Networking = lazy(() => import('./pages/Networking'));
const AgentQuestions = lazy(() => import('./pages/AgentQuestions'));


const ApplicationAnalytics = lazy(() => import('./pages/ApplicationAnalytics'));
const PrivacyReadiness = lazy(() => import('./pages/PrivacyReadiness'));
const OneShotPipeline = lazy(() => import('./pages/OneShotPipeline'));
const TypstResumeStudio = lazy(() => import('./pages/TypstResumeStudio'));
const CandidateAnswerBank = lazy(() => import('./pages/CandidateAnswerBank'));
const AgentReachHub = lazy(() => import('./pages/AgentReachHub'));
const LandingPage = lazy(() => import('./pages/Landing'));
const Omnisave = lazy(() => import('./pages/Omnisave'));
const TayariComputerControlRoom = lazy(() => import('./components/TayariComputerControlRoom'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

// ponytail: one-time localStorage→server migration flag guard (M4 §6).
// Null-rendering component so the hook runs inside the provider tree.
const MigrationRunner = () => {
  useMigrateAutomationRuns();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AutomationProvider>
      <MigrationRunner />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ScrollToTop />
        <ActivityDrawer />
        <BrowserRouter>
          <ScrollToTopHandler />
          <PageTransition>
          <Suspense fallback={<LoadingFallback />}>
            <RouteErrorBoundary>
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/omnisave" element={<Omnisave />} />
              <Route path="/control-room" element={<ProtectedRoute><TayariComputerControlRoom /></ProtectedRoute>} />
              {features.oneShotPipeline && (
                <Route path="/one-shot" element={<OneShotPipeline />} />
              )}
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/free-scan" element={<FreeAtsScan />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/resume-graph" element={<ResumeGraph />} />
              <Route path="/interview" element={<ProtectedRoute><InterviewBoard /></ProtectedRoute>} />
              <Route path="/interview/kanban" element={<ProtectedRoute><InterviewBoard /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><InterviewBoard /></ProtectedRoute>} />

              {/* Conditionally Rendered Routes */}
              {features.careerRoadmap && (
                <Route path="/roadmap" element={<CareerRoadmap />} />
              )}
              {features.jobSearch && (
                <>
                  <Route path="/jobs" element={<JobSearch />} />
                  <Route path="/job-search" element={<JobSearch />} />
                  <Route path="/jobs/autopilot" element={<AutoPilot />} />
                </>
              )}
              {features.pricing && (
                <Route path="/pricing" element={<Pricing />} />
              )}
              {/* ponytail: methodology is a trust page — always available, no flag */}
              <Route path="/methodology" element={<Methodology />} />
              {features.careers && (
                <Route path="/careers" element={<Careers />} />
              )}
              {features.careerOps && (
                <Route path="/career-intelligence" element={<CareerIntelligence />} />
              )}
              {features.blog && (
                <>
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                </>
              )}
              {features.help && (
                <Route path="/help" element={<Help />} />
              )}

              {/* Redirects for disabled routes in Production */}
              {!features.careerRoadmap && (
                <Route path="/roadmap" element={<Navigate to="/resume" replace />} />
              )}
              {!features.jobSearch && (
                <>
                  <Route path="/jobs" element={<Navigate to="/resume" replace />} />
                  <Route path="/jobs/*" element={<Navigate to="/resume" replace />} />
                </>
              )}
              {!features.oneShotPipeline && (
                <Route path="/one-shot" element={<Navigate to="/" replace />} />
              )}
              {!features.pricing && (
                <Route path="/pricing" element={<Navigate to="/" replace />} />
              )}

              <Route path="/about" element={<About />} />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pipeline"
                element={
                  <ProtectedRoute>
                    <Pipeline />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/companion-insights"
                element={
                  <ProtectedRoute>
                    <PetInsights />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <PredictiveAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/api-keys"
                element={
                  <ProtectedRoute>
                    <APIKeys />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/linkedin-import"
                element={
                  <ProtectedRoute>
                    <LinkedInImport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-hub"
                element={
                  <ProtectedRoute>
                    <KnowledgeHub />
                  </ProtectedRoute>
                }
              />
              <Route path="/resume" element={<ResumeUpload />} />
              <Route
                path="/resume/results"
                element={
                  <ProtectedRoute>
                    <ResumeResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/typst-studio"
                element={
                  <ProtectedRoute>
                    <TypstResumeStudio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/answer-bank"
                element={
                  <ProtectedRoute>
                    <CandidateAnswerBank />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agent-reach"
                element={
                  <ProtectedRoute>
                    <AgentReachHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resume/templates"
                element={
                  <ProtectedRoute>
                    <ResumeTemplates />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cover-letter"
                element={
                  <ProtectedRoute>
                    <CoverLetter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/communication"
                element={
                  <ProtectedRoute>
                    <CommunicationHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview/prep"
                element={
                  <ProtectedRoute>
                    <InterviewPrep />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview/voice-coach"
                element={
                  <ProtectedRoute>
                    <InterviewVoiceCoach />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/negotiation"
                element={
                  <ProtectedRoute>
                    <NegotiationCopilot />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/radar"
                element={
                  <ProtectedRoute>
                    <CompanyRadar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/skill-gap-radar"
                element={
                  <ProtectedRoute>
                    <SkillGapRadar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portfolio"
                element={
                  <ProtectedRoute>
                    <PortfolioGenerator />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/outreach"
                element={
                  <ProtectedRoute>
                    <RecruiterOutreach />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/networking"
                element={
                  <ProtectedRoute>
                    <Networking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/questions"
                element={
                  <ProtectedRoute>
                    <AgentQuestions />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/analytics-funnel"
                element={
                  <ProtectedRoute>
                    <ApplicationAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/privacy-diagnostics"
                element={
                  <ProtectedRoute>
                    <PrivacyReadiness />
                  </ProtectedRoute>
                }
              />
              <Route path="/extension-onboarding" element={<ExtensionOnboarding />} />
              <Route
                path="/review-queue"
                element={
                  <ProtectedRoute>
                    <ReviewQueue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agents"
                element={
                  <ProtectedRoute>
                    <AgentPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/advisor"
                element={
                  <ProtectedRoute>
                    <AdvisorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/career-ops"
                element={
                  <ProtectedRoute>
                    <CareerOpsDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </RouteErrorBoundary>
          </Suspense>
          </PageTransition>
        </BrowserRouter>
      </TooltipProvider>
      </AutomationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
