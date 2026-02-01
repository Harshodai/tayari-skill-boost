
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

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import ResumeUpload from "./pages/ResumeUpload";
import ResumeResults from "./pages/ResumeResults";
import ResumeTemplates from "./pages/ResumeTemplates";
import InterviewComingSoon from "./pages/InterviewComingSoon";
import CareerRoadmap from "./pages/CareerRoadmap";
import JobsComingSoon from "./pages/JobsComingSoon";
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
import AuthCallback from "./pages/AuthCallback";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ScrollToTop />
        <BrowserRouter>
          <ScrollToTopHandler />
          <PageTransition>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Conditionally Rendered Routes */}
              {features.interviewPrep && (
                <Route path="/interview" element={<InterviewComingSoon />} />
              )}
              {features.careerRoadmap && (
                <Route path="/roadmap" element={<CareerRoadmap />} />
              )}
              {features.jobSearch && (
                <Route path="/jobs" element={<JobsComingSoon />} />
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
                <Route path="/jobs" element={<Navigate to="/resume" replace />} />
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

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
