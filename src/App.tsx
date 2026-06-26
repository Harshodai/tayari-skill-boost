
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

import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import ResumeUpload from "./pages/ResumeUpload";
import ResumeResults from "./pages/ResumeResults";
import ResumeTemplates from "./pages/ResumeTemplates";
import InterviewBoard from "./pages/InterviewBoard";
import JobSearch from "./pages/JobSearch";
import AutoPilot from "./pages/AutoPilot";
import CareerRoadmap from "./pages/CareerRoadmap";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Careers from "./pages/Careers";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Help from "./pages/Help";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Profile from "./pages/Profile";
import CoverLetter from "./pages/CoverLetter";
import CommunicationHub from "./pages/CommunicationHub";
import InterviewPrep from "./pages/InterviewPrep";
import KnowledgeHub from "./pages/KnowledgeHub";
import ExtensionOnboarding from "./pages/ExtensionOnboarding";
import ReviewQueue from "./pages/ReviewQueue";
import PredictiveAnalytics from "./pages/PredictiveAnalytics";
import AdvisorDashboard from "./pages/AdvisorDashboard";
import AgentPanel from "./pages/AgentPanel";
import CareerOpsDashboard from "./pages/CareerOpsDashboard";
import NotFound from "./pages/NotFound";

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
          </PageTransition>
        </BrowserRouter>
      </TooltipProvider>
      </AutomationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
