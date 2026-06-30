import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listApplications,
  listSavedJobs,
  updateCommunicationResponse,
  getCommunicationStats,
  type CommTypeStat,
} from "@/api";
import {
  Mail,
  Copy,
  Loader2,
  Sparkles,
  Check,
  ArrowLeft,
  Send,
  Clock,
  MessageSquare,
  Briefcase,
  Building2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

function getToken() {
  return localStorage.getItem("auth_token");
}

async function fetchCommunicationSuggestions() {
  const res = await fetch(`${API_URL}/v1/communication/suggestions`, {
    headers: { Authorization: getToken() ? `Bearer ${getToken()}` : "" },
  });
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  return res.json();
}

async function generateCommunication(payload: any) {
  const res = await fetch(`${API_URL}/v1/communication/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to generate communication");
  return res.json();
}

// ponytail: shared constant — the four post-apply message templates. Used by
// the ?type= query-param validation and the template button row (DRY).
const COMM_TYPES = ["follow-up", "thank-you", "negotiation", "status-check"] as const;

const CommunicationHub = () => {
  const [activeTab, setActiveTab] = useState("suggestions");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [commType, setCommType] = useState("follow-up");
  const [generated, setGenerated] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [searchParams] = useSearchParams();

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["communication-suggestions"],
    queryFn: () => fetchCommunicationSuggestions(),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => listSavedJobs(),
  });

  // Pre-fill application + message type from URL query params (e.g., from
  // the Pipeline Kanban — dragging to a stage deep-links with ?type=<mapped>).
  useEffect(() => {
    const qAppId = searchParams.get("app");
    if (qAppId && applications.length > 0) {
      const app = applications.find((a: any) => (a.application_id || a.id) === qAppId);
      if (app) {
        setSelectedApp(app);
        setActiveTab("generator");
      }
    }
    const qType = searchParams.get("type");
    if (qType && (COMM_TYPES as readonly string[]).includes(qType)) {
      setCommType(qType);
      setActiveTab("generator");
    }
  }, [searchParams, applications]);

  const generateMutation = useMutation({
    mutationFn: generateCommunication,
    onSuccess: (data) => {
      setGenerated(data);
      toast.success("Communication generated!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  // Audit #6 — per-touchpoint response rate. Stats power the Response Rate
  // tab; the mark mutation flips a comm's status and refreshes the aggregate.
  const qc = useQueryClient();
  const { data: statsData } = useQuery({
    queryKey: ["communication-stats"],
    queryFn: () => getCommunicationStats(),
  });
  const responseMutation = useMutation({
    mutationFn: ({ commId, status }: { commId: number; status: "responded" | "no_response" }) =>
      updateCommunicationResponse(commId, status),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["communication-stats"] });
      toast.success(vars.status === "responded" ? "Marked as responded" : "Marked no response");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  const suggestions = suggestionsData?.suggestions || [];

  const getAppDetails = (appId: string) => {
    const app = applications.find((a: any) => a.application_id === appId || a.id === appId);
    if (!app) return { title: "Unknown", company: "Unknown", status: app?.status || "saved" };
    const job = savedJobs.find((j: any) => j.id === (app as any).saved_job_id);
    const jobData = job?.job || {};
    return {
      title: jobData.title || app.job?.title || "Unknown",
      company: jobData.company || app.job?.company || "Unknown",
      status: app.status,
    };
  };

  const handleGenerate = (type: string, appId: string) => {
    const app = applications.find((a: any) => a.application_id === appId || a.id === appId);
    if (!app) return;
    const details = getAppDetails(appId);
    setCommType(type);
    setIsGenerating(true);
    generateMutation.mutate({
      comm_type: type,
      application_id: appId,
      job_title: details.title,
      company_name: details.company,
      days_since: 3,
    }, {
      onSettled: () => setIsGenerating(false),
    });
  };

  const handleCopy = () => {
    if (!generated?.body) return;
    navigator.clipboard.writeText(`Subject: ${generated.subject}\n\n${generated.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const typeLabels: Record<string, string> = {
    "follow-up": "Follow Up",
    "thank-you": "Thank You",
    "negotiation": "Negotiation",
    "status-check": "Status Check",
    "apply-reminder": "Apply Reminder",
  };

  const getSuggestionVariant = (type: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "subtle" => {
    switch (type?.toLowerCase()) {
      case "follow-up":
        return "info";
      case "thank-you":
        return "success";
      case "negotiation":
        return "warning";
      case "status-check":
        return "default";
      case "apply-reminder":
        return "subtle";
      default:
        return "secondary";
    }
  };

  return (
    <AppShell>
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
            <Mail className="w-4 h-4" />
            Communication Command Center
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Smart Communication
          </h1>
          <p className="text-muted-foreground text-lg">
            AI-generated follow-ups, thank-you notes, and negotiation scripts tailored to your applications.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suggestions">Smart Suggestions</TabsTrigger>
            <TabsTrigger value="generator">Communication Generator</TabsTrigger>
            <TabsTrigger value="rates">Response Rate</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-6">
            {suggestionsLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-4">Loading suggestions...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12">
                <Check className="w-12 h-12 mx-auto mb-4 text-success opacity-50" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-muted-foreground mt-2">
                  No pending communication suggestions right now. Your applications are on track.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {suggestions.map((s: any, idx: number) => {
                  const details = getAppDetails(s.application_id);
                  return (
                    <Card key={idx} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getSuggestionVariant(s.suggestion_type)}>
                                {typeLabels[s.suggestion_type] || s.suggestion_type}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {details.company}
                              </span>
                            </div>
                            <h3 className="font-semibold text-lg">{details.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {s.timing_note}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Status: {details.status}</span>
                              <span>•</span>
                              <span>{s.days_since} days since last update</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleGenerate(s.suggestion_type, s.application_id)}
                            disabled={isGenerating}
                            className="shrink-0"
                          >
                            {isGenerating && selectedApp?.application_id === s.application_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Generate
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="generator" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Select Application</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {applications.map((app: any) => {
                        const details = getAppDetails(app.application_id || app.id);
                        return (
                          <button
                            key={app.id || app.application_id}
                            onClick={() => setSelectedApp(app)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedApp?.id === app.id || selectedApp?.application_id === app.application_id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{details.title}</p>
                                <p className="text-xs text-muted-foreground">{details.company}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {details.status}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {selectedApp && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Communication Type</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {COMM_TYPES.map((type) => (
                        <Button
                          key={type}
                          variant={commType === type ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setCommType(type)}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          {typeLabels[type]}
                        </Button>
                      ))}
                      <Button
                        className="w-full"
                        onClick={() => handleGenerate(commType, selectedApp.application_id || selectedApp.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        Generate {typeLabels[commType]}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Generated Communication</CardTitle>
                    {generated && (
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {generated ? (
                      <div className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Subject</p>
                          <p className="text-sm font-medium">{generated.subject}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                          {generated.body}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{generated.word_count} words</Badge>
                          <span>•</span>
                          <span>{generated.timing_note}</span>
                        </div>
                        {generated.comm_id && (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                            <span className="text-xs text-muted-foreground mr-1">Got a reply?</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-success border-success/30"
                              disabled={responseMutation.isPending}
                              onClick={() =>
                                responseMutation.mutate({ commId: generated.comm_id, status: "responded" })
                              }
                            >
                              <Check className="w-3.5 h-3.5" /> Responded
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-muted-foreground"
                              disabled={responseMutation.isPending}
                              onClick={() =>
                                responseMutation.mutate({ commId: generated.comm_id, status: "no_response" })
                              }
                            >
                              No response
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-12">
                        <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Select an application and communication type to generate.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Audit #6 — per-touchpoint response-rate dashboard */}
          <TabsContent value="rates">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Response rate by touchpoint</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Mark generated messages as responded once you hear back. The rates reveal which touchpoints actually convert — the data nobody else tracks.
              </p>
              {(!statsData?.stats || statsData.stats.length === 0) ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    No tracked messages yet. Generate a message and mark it when you get a reply.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {statsData.stats.map((s: CommTypeStat) => (
                    <Card key={s.comm_type} className="border-border/40">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{typeLabels[s.comm_type] || s.comm_type}</span>
                          <Badge variant="secondary">{s.total} sent</Badge>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-primary">{s.response_rate}%</span>
                          <span className="text-xs text-muted-foreground mb-1">responded</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${s.response_rate}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="text-success">{s.responded} responded</span>
                          <span>{s.no_response} no response</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default CommunicationHub;
