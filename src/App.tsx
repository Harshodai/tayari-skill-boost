import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResumeUpload from "./pages/ResumeUpload";
import ResumeResults from "./pages/ResumeResults";
import ResumeTemplates from "./pages/ResumeTemplates";
import InterviewComingSoon from "./pages/InterviewComingSoon";
import JobsComingSoon from "./pages/JobsComingSoon";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/interview" element={<InterviewComingSoon />} />
            <Route path="/jobs" element={<JobsComingSoon />} />

            {/* Protected Routes */}
            <Route
              path="/resume"
              element={
                <ProtectedRoute>
                  <ResumeUpload />
                </ProtectedRoute>
              }
            />
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
