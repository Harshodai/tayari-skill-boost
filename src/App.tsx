
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
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { LoadingFallback } from "@/components/LoadingFallback";

import { lazy, Suspense } from 'react';
const Index = lazy(() => import('./pages/Index'));

const Onboarding = lazy(() => import('./pages/Onboarding'));
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Settings = lazy(() => import('./pages/Settings'));
const ResumeUpload = lazy(() => import('./pages/ResumeUpload'));
const ResumeResults = lazy(() => import('./pages/ResumeResults'));
const ResumeTemplates = lazy(() => import('./pages/ResumeTemplates'));
const InterviewBoard = lazy(() => import('./pages/InterviewBoard'));
const JobSearch = lazy(() => import('./pages/JobSearch'));
const AutoPilot = lazy(() => import('./pages/AutoPilot'));
const CareerRoadmap = lazy(() => import('./pages/CareerRoadmap'));
const CareerIntelligence = lazy(() => import('./pages/CareerIntelligence').then(m => ({ default: m.CareerIntelligence })));
const FAQ = lazy(() => import('./pages/FAQ'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
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

const CareerOpsDashboard = lazy(() => import('./pages/CareerOpsDashboard'));
const LinkedInImport = lazy(() => import('./pages/LinkedInImport'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AutomationProvider>
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
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/resume-graph" element={<ResumeGraph />} />

              {/* Conditionally Rendered Routes */}
              {features.interviewPrep && (
                <Route path="/interview" element={<InterviewBoard />} />
              )}
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
              {!features.interviewPrep && (
                <Route path="/interview" element={<Navigate to="/resume" replace />} />
              )}
              {!features.careerRoadmap && (
                <Route path="/roadmap" element={<Navigate to="/resume" replace />} />
              )}
              {!features.jobSearch && (
                <>
                  <Route path="/jobs" element={<Navigate to="/resume" replace />} />
                  <Route path="/jobs/*" element={<Navigate to="/resume" replace />} />
                </>
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
