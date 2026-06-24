import React, { useState, useEffect } from "react";
import { 
  Users, 
  FileText, 
  Mic, 
  Send, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  Filter, 
  FolderPlus,
  Loader2,
  ChevronRight,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";

interface Cohort {
  id: number;
  tenant_id: string;
  name: string;
  created_at: string;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  headline: string;
  cohort_id: number | null;
  cohort_name: string;
  resume_count: number;
  avg_interview_score: number;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export default function AdvisorDashboard() {
  const { session } = useAuth();
  const { tenant } = useTenant();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCohort, setIsCreatingCohort] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertBody, setAlertBody] = useState("");
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedCohort]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session?.access_token}`,
        "X-Tenant-Domain": window.location.host,
      };

      // 1. Fetch Cohorts
      const cohortsRes = await fetch(`${API_URL}/v1/advisor/cohorts`, { headers });
      if (cohortsRes.ok) {
        const cohortsData = await cohortsRes.json();
        setCohorts(cohortsData || []);
      }

      // 2. Fetch Students
      let url = `${API_URL}/v1/advisor/students`;
      if (selectedCohort) {
        url += `?cohort_id=${selectedCohort}`;
      }
      const studentsRes = await fetch(url, { headers });
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData || []);
      }
    } catch (err) {
      console.error("Error loading advisor dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortName.trim()) return;

    try {
      const res = await fetch(`${API_URL}/v1/advisor/cohorts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          "X-Tenant-Domain": window.location.host,
        },
        body: JSON.stringify({ name: newCohortName }),
      });

      if (res.ok) {
        const newCohort = await res.json();
        setCohorts((prev) => [...prev, newCohort]);
        setNewCohortName("");
        setIsCreatingCohort(false);
        showStatus("success", `Cohort "${newCohort.name}" created successfully!`);
      } else {
        const data = await res.json();
        showStatus("error", data.error || "Failed to create cohort");
      }
    } catch (err) {
      showStatus("error", "Network error creating cohort");
    }
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !alertTitle.trim() || !alertBody.trim()) return;

    setIsSendingAlert(true);
    try {
      const res = await fetch(`${API_URL}/v1/push/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          user_id: selectedStudent.id,
          title: alertTitle,
          body: alertBody,
        }),
      });

      if (res.ok) {
        setIsAlertModalOpen(false);
        setAlertTitle("");
        setAlertBody("");
        showStatus("success", `Push notification alert dispatched to ${selectedStudent.full_name}!`);
      } else {
        const data = await res.json();
        showStatus("error", data.error || "Failed to send notification. Make sure student is subscribed.");
      }
    } catch (err) {
      showStatus("error", "Network error sending notification");
    } finally {
      setIsSendingAlert(false);
    }
  };

  const showStatus = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.full_name.toLowerCase().includes(searchLower) ||
      student.email.toLowerCase().includes(searchLower) ||
      student.headline.toLowerCase().includes(searchLower)
    );
  });

  // Calculate metrics
  const totalStudents = students.length;
  const totalResumes = students.reduce((acc, curr) => acc + curr.resume_count, 0);
  const studentsWithScore = students.filter((s) => s.avg_interview_score > 0);
  const avgScore = studentsWithScore.length
    ? Math.round(studentsWithScore.reduce((acc, curr) => acc + curr.avg_interview_score, 0) / studentsWithScore.length)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Branding header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gradient">
              {tenant?.name || "Tayari"} Advisor Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              White-label Portal for domain <code className="text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">{window.location.host}</code>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreatingCohort(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 rounded-lg font-medium text-sm shadow-lg shadow-primary/20"
            >
              <FolderPlus className="h-4 w-4" />
              New Cohort
            </button>
          </div>
        </div>

        {/* Status notification toast */}
        {statusMessage && (
          <div className={`p-4 rounded-lg flex items-start gap-3 border ${
            statusMessage.type === "success" 
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" 
              : "bg-red-950/20 border-red-500/30 text-red-400"
          } animate-fade-in`}>
            {statusMessage.type === "success" ? (
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium">{statusMessage.text}</p>
          </div>
        )}

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass border border-border/60 rounded-xl p-6 glow-primary">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Candidates</span>
              <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">{totalStudents}</span>
              <span className="text-xs text-muted-foreground">across all segments</span>
            </div>
          </div>

          <div className="glass border border-border/60 rounded-xl p-6 glow-primary">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resumes Audited</span>
              <div className="bg-blue-500/10 p-2.5 rounded-lg text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">{totalResumes}</span>
              <span className="text-xs text-muted-foreground">files uploaded</span>
            </div>
          </div>

          <div className="glass border border-border/60 rounded-xl p-6 glow-primary">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Interview Score</span>
              <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">{avgScore}%</span>
              <span className="text-xs text-muted-foreground">from STAR prep sessions</span>
            </div>
          </div>
        </div>

        {/* Filters and List */}
        <div className="glass border border-border/60 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-border/40 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 bg-background border border-border/60 rounded-lg px-3 py-2 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search candidates by name, email or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-sm w-full outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="bg-background border border-border/60 text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading candidates database...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No candidates found</p>
              <p className="text-sm mt-1">Try resetting the cohort filter or modifying the search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/10 border-b border-border/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-4 px-6">Candidate</th>
                    <th className="py-4 px-6">Cohort</th>
                    <th className="py-4 px-6 text-center">Resumes</th>
                    <th className="py-4 px-6 text-center">Avg AI Interview</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
                            {student.full_name ? student.full_name.charAt(0).toUpperCase() : student.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{student.full_name || "Guest User"}</div>
                            <div className="text-xs text-muted-foreground">{student.email}</div>
                            {student.headline && <div className="text-[11px] text-primary/80 mt-0.5">{student.headline}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm font-medium">
                        {student.cohort_name ? (
                          <span className="bg-primary/5 border border-primary/10 text-primary/90 text-xs px-2.5 py-1 rounded-full">
                            {student.cohort_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold h-6 px-2.5 rounded-full">
                          {student.resume_count}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {student.avg_interview_score > 0 ? (
                          <span className={`inline-flex items-center justify-center text-xs font-semibold h-6 px-2.5 rounded-full border ${
                            student.avg_interview_score >= 80 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : student.avg_interview_score >= 60 
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" 
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {Math.round(student.avg_interview_score)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium italic">No scores</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsAlertModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground transition-colors px-3 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Alert Candidate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: New Cohort */}
        {isCreatingCohort && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border/60 rounded-xl max-w-md w-full p-6 shadow-2xl animate-fade-in-up">
              <h3 className="text-xl font-bold text-gradient mb-4">Create New Cohort</h3>
              <form onSubmit={handleCreateCohort} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cohort Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Engineering Cohort 2026"
                    value={newCohortName}
                    onChange={(e) => setNewCohortName(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCohort(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-dark text-primary-foreground font-semibold px-4 py-2 text-sm rounded-lg transition-colors"
                  >
                    Create Cohort
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Send Notification */}
        {isAlertModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border/60 rounded-xl max-w-md w-full p-6 shadow-2xl animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4 border-b border-border/40 pb-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Alert {selectedStudent.full_name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                This triggers a real-time Web-Push Notification that will appear on the candidate's browser/mobile device.
              </p>
              <form onSubmit={handleSendPush} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alert Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Resume Feedback Ready"
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Message Body</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="e.g. I have reviewed your latest resume. Please check the skill gap analysis and fill in the missing metrics."
                    value={alertBody}
                    onChange={(e) => setAlertBody(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAlertModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-muted/60 transition-colors"
                    disabled={isSendingAlert}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-dark text-primary-foreground font-semibold px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5"
                    disabled={isSendingAlert}
                  >
                    {isSendingAlert ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Send Push Alert
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
