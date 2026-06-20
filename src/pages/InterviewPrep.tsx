import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { listApplications, listSavedJobs } from "@/api";
import {
  Brain,
  Loader2,
  Sparkles,
  ArrowLeft,
  Timer,
  Eye,
  EyeOff,
  Star,
  CheckCircle2,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

function getToken() {
  return localStorage.getItem("auth_token");
}

async function fetchInterviewPrep(payload: any) {
  const res = await fetch(`${API_URL}/v1/interview/prep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to generate interview prep");
  return res.json();
}

const InterviewPrep = () => {
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [interviewType, setInterviewType] = useState("behavioral");
  const [prepData, setPrepData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [selfScores, setSelfScores] = useState<Record<number, number>>({});
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [searchParams] = useSearchParams();

  // Pre-fill application from URL query param (e.g., from InterviewBoard)
  useEffect(() => {
    const qAppId = searchParams.get("app");
    if (qAppId) setSelectedAppId(qAppId);
  }, [searchParams]);

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });
  const { data: savedJobs = [] } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => listSavedJobs(),
  });

  const interviewApps = applications.filter((a: any) =>
    ["phone_screen", "interview"].includes(a.status)
  );

  const selectedApp = interviewApps.find(
    (a: any) => (a.application_id || a.id) === selectedAppId
  );
  const selectedJob = selectedApp
    ? savedJobs.find((j: any) => j.id === (selectedApp as any).saved_job_id)
    : null;

  const handleGenerate = async () => {
    if (!selectedAppId) {
      toast.error("Select an application first");
      return;
    }
    setIsGenerating(true);
    try {
      const payload: any = {
        application_id: selectedAppId,
        interview_type: interviewType,
      };
      if (selectedJob) {
        const job = selectedJob.job || {};
        payload.job_title = job.title || "";
        payload.company_name = job.company || "";
        payload.job_description = job.description || "";
      }
      const result = await fetchInterviewPrep(payload);
      setPrepData(result);
      setExpandedQuestion(null);
      setPracticeMode(false);
      toast.success("Interview prep generated!");
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTimer = () => {
    if (timerActive) {
      setTimerActive(false);
    } else {
      setTimerActive(true);
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev >= 120) {
            clearInterval(interval);
            setTimerActive(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleStarClick = (qIdx: number, star: number) => {
    setSelfScores((prev) => ({ ...prev, [qIdx]: star }));
  };

  const typeColors: Record<string, string> = {
    behavioral: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    technical: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "system-design": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };

  const questions = prepData?.questions || [];
  const companySpecific = prepData?.company_specific;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Brain className="w-4 h-4" />
            AI-Powered Interview Prep
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Resume-Aware Interview Coach
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate behavioral, technical, and system-design questions tailored to your resume and target role.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Controls */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Application</label>
                  <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an interview..." />
                    </SelectTrigger>
                    <SelectContent>
                      {interviewApps.map((app: any) => {
                        const job = savedJobs.find((j: any) => j.id === app.saved_job_id);
                        const jobData = job?.job || {};
                        return (
                          <SelectItem key={app.id || app.application_id} value={app.application_id || app.id}>
                            {jobData.title || "Untitled"} @ {jobData.company || "Unknown"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Interview Type</label>
                  <Select value={interviewType} onValueChange={setInterviewType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="behavioral">Behavioral (STAR)</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="system-design">System Design</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button className="w-full" onClick={handleGenerate} disabled={isGenerating || !selectedAppId}>
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Prep
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPracticeMode(!practiceMode)}
                    disabled={!prepData}
                  >
                    {practiceMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company-specific banner */}
          {companySpecific && (
            <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{companySpecific.company} Interview Prep</p>
                    <p className="text-xs text-muted-foreground">
                      Focus areas: {companySpecific.principles?.slice(0, 3).join(", ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timer */}
          {prepData && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={toggleTimer}>
                <Timer className="w-4 h-4 mr-2" />
                {timerActive ? formatTime(timer) : "Start Timer"}
              </Button>
              {timerActive && (
                <Badge variant="secondary">
                  {interviewType === "behavioral" ? "2:00 recommended" : "5:00 recommended"}
                </Badge>
              )}
            </div>
          )}

          {/* Questions */}
          {questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q: any, idx: number) => (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={typeColors[q.category] || ""}>{q.category}</Badge>
                        <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {practiceMode && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleStarClick(idx, star)}
                                className={`text-sm ${
                                  (selfScores[idx] || 0) >= star
                                    ? "text-yellow-500"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <Star className="w-4 h-4" fill={(selfScores[idx] || 0) >= star ? "currentColor" : "none"} />
                              </button>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                        >
                          {expandedQuestion === idx ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="font-medium text-base mb-2">{q.question}</p>
                    {q.source_bullet && (
                      <p className="text-xs text-muted-foreground mb-3">
                        From resume: {q.source_bullet}
                      </p>
                    )}

                    {expandedQuestion === idx && !practiceMode && (
                      <div className="mt-4 space-y-3 bg-muted/50 rounded-lg p-4">
                        {q.star_suggested && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">STAR Suggested</p>
                            <div className="grid gap-2 text-sm">
                              <div><span className="font-medium">S:</span> {q.star_suggested.situation}</div>
                              <div><span className="font-medium">T:</span> {q.star_suggested.task}</div>
                              <div><span className="font-medium">A:</span> {q.star_suggested.action}</div>
                              <div><span className="font-medium">R:</span> {q.star_suggested.result}</div>
                            </div>
                          </div>
                        )}
                        {q.suggested_answer && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Suggested Answer</p>
                            <p className="text-sm whitespace-pre-wrap">{q.suggested_answer}</p>
                          </div>
                        )}
                        {q.suggested_approach && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Approach</p>
                            <p className="text-sm whitespace-pre-wrap">{q.suggested_approach}</p>
                          </div>
                        )}
                        {q.requirements && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Requirements</p>
                            <p className="text-sm">{q.requirements}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {practiceMode && expandedQuestion === idx && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">
                          Practice mode is on. Hide the suggested answers and try answering yourself!
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Rate yourself 1-5 stars after practicing.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!prepData && !isGenerating && (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">
                Select an application and interview type to generate personalized prep materials.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default InterviewPrep;
