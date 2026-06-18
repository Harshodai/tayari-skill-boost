import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Briefcase,
  Calendar,
  ArrowRight,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Star,
  History
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisHistoryList } from "@/components/resume/AnalysisHistoryList";
import type { ResumeAnalysisRecord } from "@/types/resume";
import { USE_SELF_HOSTED, listResumes, listAnalysisHistory } from "@/api";
import { listJDs } from "@/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data for saved resumes
const savedResumes = [
  {
    id: "1",
    name: "Software Engineer Resume",
    lastModified: "2024-01-08",
    score: 85,
    status: "optimized",
    version: 3,
  },
  {
    id: "2",
    name: "Full Stack Developer CV",
    lastModified: "2024-01-05",
    score: 72,
    status: "needs-improvement",
    version: 2,
  },
  {
    id: "3",
    name: "Frontend Developer Resume",
    lastModified: "2024-01-02",
    score: 91,
    status: "optimized",
    version: 1,
  },
];

// Mock data for application history
const applicationHistory = [
  {
    id: "1",
    company: "TechCorp Inc.",
    position: "Senior Software Engineer",
    appliedDate: "2024-01-08",
    status: "interview",
    resumeUsed: "Software Engineer Resume",
  },
  {
    id: "2",
    company: "StartupXYZ",
    position: "Full Stack Developer",
    appliedDate: "2024-01-06",
    status: "applied",
    resumeUsed: "Full Stack Developer CV",
  },
  {
    id: "3",
    company: "Global Tech",
    position: "Frontend Engineer",
    appliedDate: "2024-01-03",
    status: "rejected",
    resumeUsed: "Frontend Developer Resume",
  },
  {
    id: "4",
    company: "Innovation Labs",
    position: "React Developer",
    appliedDate: "2024-01-01",
    status: "offer",
    resumeUsed: "Software Engineer Resume",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "optimized":
      return <Badge className="bg-success/20 text-success border-success/30">Optimized</Badge>;
    case "needs-improvement":
      return <Badge className="bg-warning/20 text-warning border-warning/30">Needs Work</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
};

const getApplicationStatusBadge = (status: string) => {
  switch (status) {
    case "interview":
      return <Badge className="bg-primary/20 text-primary border-primary/30">Interview</Badge>;
    case "applied":
      return <Badge className="bg-muted text-muted-foreground border-border">Applied</Badge>;
    case "rejected":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>;
    case "offer":
      return <Badge className="bg-success/20 text-success border-success/30">Offer!</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("history");

  // Fetch analysis history
  const { data: analysisHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["resume-analyses", user?.id],
    queryFn: async () => {
      if (USE_SELF_HOSTED) {
        const res = await listAnalysisHistory();
        // Normalize Go format → UI format
        return res.map((item: any) => ({
          id: String(item.id),
          user_id: item.user_id ?? "",
          resume_filename: `Resume #${item.resume_id}`,
          overall_score: item.score ?? 0,
          created_at: item.created_at,
          analysis_data: {
            overallScore: item.score ?? 0,
            sections: [],
            matchedKeywords: [],
            missingKeywords: [],
            summaryRecommendation: "View the detailed analysis for this result.",
          },
          job_title: undefined,
          company_name: undefined,
        })) as ResumeAnalysisRecord[];
      }
      const { data, error } = await supabase
        .from("resume_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as ResumeAnalysisRecord[];
    },
    enabled: !!user,
  });

  // Fetch saved resumes (self-hosted)
  const { data: savedResumesData = [] } = useQuery({
    queryKey: ["saved-resumes", user?.id],
    queryFn: async () => {
      if (USE_SELF_HOSTED) {
        const res = await listResumes();
        return res.map((r: any) => ({
          id: String(r.id),
          name: r.title,
          lastModified: r.updated_at?.split("T")[0] || r.created_at?.split("T")[0] || "",
          score: r.status === "optimized" ? 90 : r.status === "parsed" ? 75 : 60,
          status: r.status,
          version: 1,
        }));
      }
      return savedResumes;
    },
    enabled: !!user,
  });

  const handleDeleteAnalysis = (id: string) => {
    queryClient.setQueryData(
      ["resume-analyses", user?.id],
      (old: ResumeAnalysisRecord[] | undefined) => old?.filter(a => a.id !== id) || []
    );
  };

  const avgScore = analysisHistory.length > 0
    ? Math.round(analysisHistory.reduce((acc, a) => acc + a.overall_score, 0) / analysisHistory.length)
    : 0;

  const stats = {
    totalResumes: savedResumesData.length,
    analyses: analysisHistory.length,
    applications: applicationHistory.length,
    avgScore,
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, <span className="text-gradient">{user?.user_metadata?.name || user?.email?.split("@")[0] || "User"}</span>
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your job search progress
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Saved Resumes", value: stats.totalResumes, icon: FileText, color: "text-primary" },
            { label: "Analyses", value: stats.analyses, icon: History, color: "text-secondary" },
            { label: "Applications", value: stats.applications, icon: Briefcase, color: "text-success" },
            { label: "Avg. Score", value: `${stats.avgScore}%`, icon: TrendingUp, color: "text-warning" },
          ].map((stat) => (
            <Card key={stat.label} className="animate-fade-in-up">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-card ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button variant="glow" onClick={() => navigate("/resume")}>
            <Upload className="w-4 h-4 mr-2" />
            Upload New Resume
          </Button>
          <Button variant="outline" onClick={() => navigate("/resume/templates")}>
            <FileText className="w-4 h-4 mr-2" />
            Browse Templates
          </Button>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="history">Analysis History</TabsTrigger>
            <TabsTrigger value="resumes">Saved Resumes</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
          </TabsList>

          {/* Analysis History Tab */}
          <TabsContent value="history" className="space-y-4">
            <AnalysisHistoryList 
              analyses={analysisHistory}
              onDelete={handleDeleteAnalysis}
              isLoading={isLoadingHistory}
            />
          </TabsContent>

          {/* Saved Resumes Tab */}
          <TabsContent value="resumes" className="space-y-4">
            {savedResumesData.length === 0 ? (
              <Card className="py-12 text-center">
                <CardContent>
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No resumes yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your first resume to get started
                  </p>
                  <Button onClick={() => navigate("/resume")}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Resume
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {savedResumesData.map((resume, index) => (
                  <Card 
                    key={resume.id} 
                    className="animate-fade-in-up card-hover"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                            <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{resume.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {resume.lastModified}
                              </span>
                              <span>v{resume.version}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`text-lg font-bold ${getScoreColor(resume.score)}`}>
                              {resume.score}%
                            </p>
                            {getStatusBadge(resume.status)}
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Star className="w-4 h-4 mr-2" />
                                Set as Default
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Application History Tab */}
          <TabsContent value="applications" className="space-y-4">
            {applicationHistory.length === 0 ? (
              <Card className="py-12 text-center">
                <CardContent>
                  <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No applications yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start tracking your job applications
                  </p>
                  <Button onClick={() => navigate("/jobs")}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Find Jobs
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {applicationHistory.map((application, index) => (
                  <Card 
                    key={application.id} 
                    className="animate-fade-in-up card-hover"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-secondary/10">
                            <Briefcase className="w-6 h-6 text-secondary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{application.position}</h3>
                            <p className="text-muted-foreground">{application.company}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Applied {application.appliedDate}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {application.resumeUsed}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {getApplicationStatusBadge(application.status)}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Update Status
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Dashboard;