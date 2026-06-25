import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight, 
  Star, 
  Brain,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Filter,
  Search,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ReviewQueueItem {
  id: number;
  application_id: string;
  job: {
    title: string;
    company: string;
    location?: string;
    description?: string;
    url?: string;
    platform?: string;
  };
  tailored_resume_text?: string;
  cover_letter?: string;
  ats_score_before: number;
  ats_score_after: number;
  dream_score: number;
  is_dream_company: boolean;
  ai_suggestion: string;
  ai_confidence: number;
  status: string;
  apply_url?: string;
  review_notes?: string;
  queued_at: string;
  created_at: string;
}

interface RuntimeApproval {
  approval_id: string;
  user_id: string;
  task_id: string | null;
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  content_preview: string;
  status: "pending" | "approved" | "rejected";
  reviewer_comment?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

interface ReviewQueueStats {
  pending_review: number;
  dream_companies: number;
  high_score_count: number;
  average_dream_score: number;
  lifetime_approved: number;
  lifetime_rejected: number;
  lifetime_submitted: number;
  requires_action: boolean;
  oldest_pending?: string;
}

export default function ReviewQueue() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [stats, setStats] = useState<ReviewQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "dream" | "high-score">("all");
  const [approvals, setApprovals] = useState<RuntimeApproval[]>([]);
  const [activeQueueTab, setActiveQueueTab] = useState<"applications" | "approvals">("applications");
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

  const token = localStorage.getItem("auth_token");

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/review-queue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch review queue");
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error("Error fetching review queue:", e);
      toast.error("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [API_URL, token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/review-queue/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  }, [API_URL, token]);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/approvals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch approvals");
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch (e) {
      console.error("Error fetching approvals:", e);
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchQueue();
    fetchStats();
    fetchApprovals();
  }, [fetchQueue, fetchStats, fetchApprovals]);

  const handleActionApproval = async (id: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`${API_URL}/v1/approvals/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, reviewer_comment: "Actioned from dashboard" }),
      });
      if (!res.ok) throw new Error("Failed to action approval");
      toast.success(`Approval request ${status}`);
      fetchApprovals();
    } catch (e) {
      toast.error(`Failed to ${status} request`);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/review-queue/${id}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Approved by user" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast.success("Application approved and moved to saved jobs");
      fetchQueue();
      fetchStats();
    } catch (e) {
      toast.error("Failed to approve application");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/review-queue/${id}/reject`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by user" }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toast.success("Application rejected");
      fetchQueue();
      fetchStats();
    } catch (e) {
      toast.error("Failed to reject application");
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/review-queue/${id}/submit`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ submission_mode: "manual" }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      toast.success("Application marked as submitted!");
      fetchQueue();
      fetchStats();
    } catch (e) {
      toast.error("Failed to submit application");
    }
  };

  const handleBulkAction = async (action: "approve" | "reject" | "submit") => {
    if (selectedItems.size === 0) {
      toast.warning("No items selected");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/review-queue/bulk-action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          application_ids: Array.from(selectedItems),
        }),
      });
      if (!res.ok) throw new Error("Bulk action failed");
      const data = await res.json();
      toast.success(`${data.processed} applications ${action}d`);
      setSelectedItems(new Set());
      fetchQueue();
      fetchStats();
    } catch (e) {
      toast.error(`Failed to ${action} applications`);
    }
  };

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const filteredItems = items.filter((item) => {
    if (filter === "dream") return item.is_dream_company;
    if (filter === "high-score") return item.dream_score >= 70;
    return true;
  });

  const getSuggestionBadge = (suggestion: string) => {
    switch (suggestion?.toLowerCase()) {
      case "approve":
        return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> Approve</Badge>;
      case "reject":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Reject</Badge>;
      case "modify":
        return <Badge variant="warning"><Sparkles className="w-3 h-3 mr-1" /> Modify</Badge>;
      default:
        return <Badge variant="secondary">Review</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              Review Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and approve applications before they're submitted
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button onClick={() => navigate("/jobs")}>
              Find Jobs
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.pending_review}</div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold flex items-center gap-1">
                  <Star className="w-5 h-5 text-warning" />
                  {stats.dream_companies}
                </div>
                <p className="text-sm text-muted-foreground">Dream Companies</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.average_dream_score}</div>
                <p className="text-sm text-muted-foreground">Avg. Dream Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.high_score_count}</div>
                <p className="text-sm text-muted-foreground">High Score (70+)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border/40 pb-4">
          <Button
            variant={activeQueueTab === "applications" ? "default" : "ghost"}
            onClick={() => setActiveQueueTab("applications")}
            className="px-4"
          >
            Applications Queue ({filteredItems.length})
          </Button>
          <Button
            variant={activeQueueTab === "approvals" ? "default" : "ghost"}
            onClick={() => setActiveQueueTab("approvals")}
            className="px-4"
          >
            Tool Approvals ({approvals.filter((a: RuntimeApproval) => a.status === "pending").length})
          </Button>
        </div>

        {activeQueueTab === "applications" && (
          <>
        {/* Filters & Bulk Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "dream" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("dream")}
            >
              <Star className="w-3 h-3 mr-1" />
              Dream
            </Button>
            <Button
              variant={filter === "high-score" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("high-score")}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              High Score
            </Button>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center">
                {selectedItems.size} selected
              </span>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("approve")}>
                <CheckCircle className="w-3 h-3 mr-1" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("submit")}>
                <ArrowRight className="w-3 h-3 mr-1" />
                Submit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction("reject")}>
                <XCircle className="w-3 h-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
        </div>

        {/* Queue Items */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Queue is empty</h3>
              <p className="text-muted-foreground text-center max-w-md mt-2">
                All applications have been reviewed. Visit the Job Search to find new opportunities.
              </p>
              <Button className="mt-4" onClick={() => navigate("/jobs")}>
                Find Jobs
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <Card key={item.application_id} className={selectedItems.has(item.application_id) ? "border-primary" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedItems.has(item.application_id)}
                      onCheckedChange={() => toggleItem(item.application_id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{item.job?.title}</h3>
                            {item.is_dream_company && (
                              <Badge variant="warning">
                                <Star className="w-3 h-3 mr-1" /> Dream
                              </Badge>
                            )}
                            {getSuggestionBadge(item.ai_suggestion)}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3" />
                            {item.job?.company}
                            {item.job?.location && (
                              <>
                                <span className="mx-1">·</span>
                                {item.job.location}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-primary">{item.dream_score}</div>
                          <p className="text-xs text-muted-foreground">Dream Score</p>
                        </div>
                      </div>

                      {/* AI Confidence Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span className="flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            AI Confidence
                          </span>
                          <span>{Math.round(item.ai_confidence * 100)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${item.ai_confidence * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {expandedItem === item.application_id && (
                        <div className="mt-4 space-y-3 border-t pt-3">
                          {item.ats_score_after > 0 && (
                            <div className="flex items-center gap-4 text-sm">
                              <span>ATS Score:</span>
                              <span className="text-muted-foreground">
                                {item.ats_score_before} → {item.ats_score_after}
                              </span>
                              <Badge variant={item.ats_score_after >= 80 ? "default" : "secondary"}>
                                {item.ats_score_after >= 80 ? "Strong" : "Moderate"}
                              </Badge>
                            </div>
                          )}
                          {item.review_notes && (
                            <div className="text-sm bg-muted p-2 rounded">
                              <p className="font-medium text-xs text-muted-foreground mb-1">Notes</p>
                              {item.review_notes}
                            </div>
                          )}
                          {item.tailored_resume_text && (
                            <div className="text-sm">
                              <p className="font-medium text-xs text-muted-foreground mb-1">Tailored Resume Preview</p>
                              <div className="bg-muted p-2 rounded max-h-32 overflow-y-auto text-xs">
                                {item.tailored_resume_text.slice(0, 300)}...
                              </div>
                            </div>
                          )}
                          {item.cover_letter && (
                            <div className="text-sm">
                              <p className="font-medium text-xs text-muted-foreground mb-1">Cover Letter Preview</p>
                              <div className="bg-muted p-2 rounded max-h-32 overflow-y-auto text-xs">
                                {item.cover_letter.slice(0, 300)}...
                              </div>
                            </div>
                          )}
                          {item.apply_url && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => window.open(item.apply_url, "_blank")}
                            >
                              Open Application Page →
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedItem(
                              expandedItem === item.application_id ? null : item.application_id
                            )
                          }
                        >
                          {expandedItem === item.application_id ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" /> Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" /> View Details
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSubmit(item.application_id)}
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Submit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(item.application_id)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleReject(item.application_id)}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        Queued {new Date(item.queued_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
        )}

        {activeQueueTab === "approvals" && (
          <div className="space-y-4">
            {approvals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No tool approval requests</h3>
                  <p className="text-muted-foreground text-center max-w-md mt-2">
                    Digital agents have not requested any runtime tool executions yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              approvals.map((approval) => (
                <Card key={approval.approval_id} className={approval.status === "pending" ? "border-primary/40 bg-primary/5" : ""}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Brain className="w-4 h-4 text-primary" />
                            {approval.agent_id}
                          </h3>
                          <Badge variant={approval.status === "pending" ? "outline" : approval.status === "approved" ? "success" : "destructive"}>
                            {approval.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Requested Tool: <span className="font-semibold text-foreground font-mono text-xs">{approval.tool_name}</span>
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(approval.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="text-sm bg-background border p-3 rounded-md">
                      <div className="font-medium text-xs text-muted-foreground mb-1">Execution Action / Preview</div>
                      {approval.content_preview}
                    </div>

                    {approval.tool_input && Object.keys(approval.tool_input).length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <ChevronDown className="w-3.5 h-3.5 mr-1" />
                            View Parameters JSON
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <pre className="text-[11px] font-mono bg-background border p-2 rounded-md max-h-32 overflow-y-auto">
                            {JSON.stringify(approval.tool_input, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {approval.status === "pending" && (
                      <div className="flex gap-2 border-t pt-3">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleActionApproval(approval.approval_id, "approved")}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                          Approve Execution
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleActionApproval(approval.approval_id, "rejected")}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Deny Execution
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
