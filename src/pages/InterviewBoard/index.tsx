import React, { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout";
import { CandidateCommandCenter } from "@/components/interview/CandidateCommandCenter";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  RotateCcw,
  AlertCircle,
  Mail,
  RefreshCw,
  LogOut,
  TrendingUp,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  addApplicationNote,
  uploadApplicationVoice,
  getGmailStatus,
  getGmailLogin,
  syncGmail,
  disconnectGmail,
  listPracticeOutcomes,
  listResumes,
} from "@/api";
import { COLUMNS } from "./types";
import type {
  ApplicationItem,
  PracticeDelta,
  GmailSyncOptions,
} from "./types";
import { InterviewColumn } from "./InterviewColumn";
import { AddInterviewModal } from "./AddInterviewModal";
import { InterviewFilters } from "./InterviewFilters";
import { EmailPasteModal } from "./EmailPasteModal";
import { PracticeModal, type ResumeOption } from "./PracticeModal";
import { MilestoneModal } from "./MilestoneModal";
import { CelebrationModal } from "./CelebrationModal";
import { RetrospectiveModal } from "./RetrospectiveModal";
import { DetailModal } from "./DetailModal";

export const InterviewBoard: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Search filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Add App state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [optimisticApps, setOptimisticApps] = useState<Record<string, string>>({});

  // Email Paste Modal state
  const [emailPasteOpen, setEmailPasteOpen] = useState(false);

  // Detail Modal state
  const [selectedApp, setSelectedApp] = useState<ApplicationItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<string>("notes");

  // Retrospective modal state (for Offer / Rejected moves)
  const [retroOpen, setRetroOpen] = useState(false);
  const [retroApp, setRetroApp] = useState<ApplicationItem | null>(null);
  const [retroTargetStage, setRetroTargetStage] = useState<string>("");
  const [isSavingRetro, setIsSavingRetro] = useState(false);

  // LinkedIn Milestone & Job Landing Celebration state
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneApp, setMilestoneApp] = useState<ApplicationItem | null>(null);
  const [milestoneStage, setMilestoneStage] = useState<"interview" | "offer">("interview");

  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationApp, setCelebrationApp] = useState<ApplicationItem | null>(null);

  // Practice session launcher modal state
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);

  // Gmail sync state
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  const openMilestoneModal = (app: ApplicationItem, stage: "interview" | "offer") => {
    setMilestoneApp(app);
    setMilestoneStage(stage);
    setMilestoneOpen(true);
  };

  const openCelebrationModal = (app: ApplicationItem) => {
    setCelebrationApp(app);
    setCelebrationOpen(true);
  };

  // Queries
  const { data: gmailStatus, refetch: refetchGmailStatus } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => getGmailStatus(),
  });

  const {
    data: rawApplications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });

  const applications = rawApplications as unknown as ApplicationItem[];

  const { data: practiceOutcomes = [] } = useQuery({
    queryKey: ["practice-outcomes"],
    queryFn: () => listPracticeOutcomes(100),
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => listResumes(),
  });

  // Practice delta calculation
  const practiceDelta: PracticeDelta | null = useMemo(() => {
    if (!practiceOutcomes || practiceOutcomes.length === 0) return null;
    const sorted = [...practiceOutcomes].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    if (sorted.length >= 2) {
      const curr = Math.round(Number(sorted[0].confidence || 0));
      const prev = Math.round(Number(sorted[1].confidence || 0));
      const improved = curr >= prev;
      return {
        headline: improved
          ? `Your STAR coverage improved from ${prev}% -> ${curr}%`
          : `Your STAR coverage changed from ${prev}% -> ${curr}%`,
        subtext: `Based on your last ${sorted.length} evaluated practice sessions. Keep targeting missing Action and Result metrics.`,
        badge: `${curr}% STAR Coverage`,
        improved,
      };
    }
    const current = Math.round(Number(sorted[0].confidence || 0));
    return {
      headline: `Current STAR coverage: ${current}%`,
      subtext: "Complete another practice session to track your STAR coverage improvement delta.",
      badge: `${current}% STAR Coverage`,
      improved: true,
    };
  }, [practiceOutcomes]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase().trim();
    return applications.filter((app) => {
      const title = (app.title || app.job?.title || "").toLowerCase();
      const comp = (app.company || app.job?.company || "").toLowerCase();
      const loc = (app.location || "").toLowerCase();
      return title.includes(q) || comp.includes(q) || loc.includes(q);
    });
  }, [applications, searchQuery]);

  const effectiveStatus = (app: ApplicationItem) =>
    optimisticApps[String(app.id)] || app.stage || app.status;

  const appsByColumn = (status: string) =>
    filteredApps.filter((a) => effectiveStatus(a) === status);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      toast.success("Application added");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to add";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateApplication(id, { status }),
    onSuccess: (_, vars) => {
      setOptimisticApps((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: unknown, vars) => {
      setOptimisticApps((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      const msg = err instanceof Error ? err.message : "Update failed";
      toast.error(msg);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      toast.success("Deleted");
      if (selectedApp && detailOpen) {
        setDetailOpen(false);
        setSelectedApp(null);
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    },
  });

  const handleAdd = (data: { title: string; company: string; location: string; url: string }) => {
    createMutation.mutate({
      title: data.title,
      company: data.company,
      location: data.location,
      url: data.url,
      stage: "saved",
    });
  };

  const handleSaveParsedEmail = (data: {
    title: string;
    company: string;
    location: string;
    stage: string;
    notes: string;
  }) => {
    createMutation.mutate({
      title: data.title,
      company: data.company,
      location: data.location,
      stage: data.stage,
      notes: data.notes,
    });
    setEmailPasteOpen(false);
  };

  const move = (app: ApplicationItem, direction: "left" | "right") => {
    const currentStage = effectiveStatus(app);
    const idx = COLUMNS.findIndex((c) => c.id === currentStage);
    const nextIdx = direction === "left" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return;
    const nextStatus = COLUMNS[nextIdx].id;

    if (nextStatus === "offer" || nextStatus === "rejected") {
      setRetroApp(app);
      setRetroTargetStage(nextStatus);
      setRetroOpen(true);
      return;
    }

    setOptimisticApps((prev) => ({ ...prev, [String(app.id)]: nextStatus }));
    updateMutation.mutate({ id: String(app.id), status: nextStatus });
    if (nextStatus === "interview") {
      openMilestoneModal(app, "interview");
    }
  };

  const handleRetroSubmit = async ({
    text,
    audioBlob,
    skip,
  }: {
    text: string;
    audioBlob: Blob | null;
    skip: boolean;
  }) => {
    if (!retroApp) return;
    setIsSavingRetro(true);

    try {
      const retroTitle = retroApp.title || retroApp.job?.title || "Untitled Role";
      const retroCompany = retroApp.company || retroApp.job?.company || "Unknown Company";
      const outcome = retroTargetStage === "offer" ? "🎉 OFFER RECEIVED" : "❌ REJECTED";
      const noteLines = [
        `=== RETROSPECTIVE — ${outcome} ===`,
        `Role: ${retroTitle} @ ${retroCompany}`,
        `Date: ${new Date().toLocaleDateString()}`,
      ];

      if (!skip) {
        if (text.trim()) noteLines.push(`\nReflection:\n${text.trim()}`);
        if (audioBlob) {
          try {
            await uploadApplicationVoice(String(retroApp.id), audioBlob);
            noteLines.push("\n[Voice reflection recorded — see Voice Notes tab for transcript]");
          } catch {
            toast.error("Failed to upload voice note.");
            setIsSavingRetro(false);
            return;
          }
        }
      } else {
        noteLines.push("\n(Retrospective skipped)");
      }

      setOptimisticApps((prev) => ({ ...prev, [String(retroApp.id)]: retroTargetStage }));
      await Promise.all([
        addApplicationNote(String(retroApp.id), noteLines.join("\n")),
        updateMutation.mutateAsync({ id: String(retroApp.id), status: retroTargetStage }),
      ]);
    } catch {
      toast.error("Failed to save retrospective. Please try again.");
      setIsSavingRetro(false);
      return;
    }

    const targetStage = retroTargetStage;
    const completedApp = retroApp;

    setIsSavingRetro(false);
    setRetroOpen(false);
    setRetroApp(null);

    const emoji = targetStage === "offer" ? "🎉" : "💪";
    toast.success(`${emoji} Retrospective saved! Your reflection will help you grow.`);

    if (targetStage === "offer" && completedApp) {
      openCelebrationModal(completedApp);
    }
  };

  // Gmail OAuth handlers
  const handleGmailConnect = async () => {
    try {
      const res = await getGmailLogin();
      if (res && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        toast.error("Failed to start Google login flow.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error launching OAuth";
      toast.error(msg);
    }
  };

  const handleGmailSync = async (options: GmailSyncOptions = {}) => {
    setIsSyncingGmail(true);
    toast.info("Syncing and scanning recently received recruiter emails...");
    try {
      const res = await syncGmail(options);
      toast.success(res?.message || "Sync complete! New applications added/updated.");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to sync Gmail messages.";
      toast.error(msg);
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleGmailDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Gmail?")) return;
    try {
      await disconnectGmail();
      toast.success("Gmail disconnected");
      refetchGmailStatus();
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      toast.success("Gmail connected successfully!");
      navigate(window.location.pathname, { replace: true });
      refetchGmailStatus();
    } else if (params.get("gmail") === "denied") {
      toast.error("Gmail connection denied by user.");
      navigate(window.location.pathname, { replace: true });
    }
  }, [navigate, refetchGmailStatus]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl space-y-8 animate-fade-in">
        {/* Candidate command center */}
        <FeatureErrorBoundary sectionName="Command Center">
          <CandidateCommandCenter
            applicationCount={applications.length}
            gmailEnabled={Boolean(gmailStatus?.enabled)}
            gmailConnected={Boolean(gmailStatus?.connected)}
            onSyncGmail={handleGmailSync}
            syncingGmail={isSyncingGmail}
          />
        </FeatureErrorBoundary>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75">
              Interview Board
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track your job applications, capture notes, record mock notes, and research custom AI interview questions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Gmail OAuth connection controls */}
            {gmailStatus?.enabled && (
              <div className="flex items-center gap-2 border bg-card/40 backdrop-blur-sm rounded-lg p-1 px-2.5 text-xs font-semibold mr-2 border-border/60">
                <Mail className="w-3.5 h-3.5 text-primary" />
                {gmailStatus.connected ? (
                  <>
                    <span className="text-success-600 dark:text-success-400">Gmail Connected</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        void handleGmailSync();
                      }}
                      disabled={isSyncingGmail}
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingGmail ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleGmailDisconnect}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <LogOut className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGmailConnect}
                    className="h-6 text-[10px] uppercase font-bold p-1 px-2 hover:bg-primary/10 text-primary"
                  >
                    Connect Gmail
                  </Button>
                )}
              </div>
            )}

            {/* AI Email Paste Button */}
            <Button
              variant="outline"
              onClick={() => setEmailPasteOpen(true)}
              className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary"
            >
              <Mail className="w-4 h-4 mr-2" />
              AI Email-Paste
            </Button>

            {/* Add Application Button */}
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Application
            </Button>

            {/* Practice STAR Button */}
            <Button
              variant="outline"
              onClick={() => setPracticeModalOpen(true)}
              className="border-primary/30 text-primary hover:bg-primary/10 font-semibold"
            >
              <Target className="w-4 h-4 mr-2" />
              Practice STAR
            </Button>
          </div>
        </div>

        {/* Practice History Delta Banner */}
        {practiceDelta && (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{practiceDelta.headline}</p>
                <p className="text-xs text-muted-foreground">{practiceDelta.subtext}</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-xs font-mono font-bold text-primary border-primary/30 px-3 py-1 bg-background"
            >
              {practiceDelta.badge}
            </Badge>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div>
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Failed to load applications
                  </p>
                  <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["applications"] })}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <InterviewFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          totalCount={applications.length}
          filteredCount={filteredApps.length}
        />

        {/* Kanban Board */}
        <FeatureErrorBoundary sectionName="Application Board">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col">
                  <div
                    className={`p-3 rounded-t-xl ${col.headerBg} border-x border-t flex items-center justify-between`}
                  >
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-6" />
                  </div>
                  <div className="flex-1 bg-card/20 border-x border-b border-border/60 rounded-b-xl p-2 space-y-3 min-h-[200px]">
                    <Card className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
              {COLUMNS.map((col, idx) => (
                <InterviewColumn
                  key={col.id}
                  column={col}
                  apps={appsByColumn(col.id)}
                  optimisticApps={optimisticApps}
                  isFirstColumn={idx === 0}
                  isLastColumn={idx === COLUMNS.length - 1}
                  onSelectApp={(app) => {
                    setSelectedApp(app);
                    setDetailTab("notes");
                    setDetailOpen(true);
                  }}
                  onMoveApp={move}
                  onDeleteApp={(id) => deleteMutation.mutate(String(id))}
                  isDeleting={deleteMutation.isPending}
                  onMilestone={openMilestoneModal}
                  onCelebration={openCelebrationModal}
                />
              ))}
            </div>
          )}
        </FeatureErrorBoundary>

        {/* Modals */}
        <AddInterviewModal
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAdd={handleAdd}
          isPending={createMutation.isPending}
        />

        <EmailPasteModal
          open={emailPasteOpen}
          onOpenChange={setEmailPasteOpen}
          onSaveParsedEmail={handleSaveParsedEmail}
        />

        <PracticeModal
          open={practiceModalOpen}
          onOpenChange={setPracticeModalOpen}
          applications={applications}
          resumes={resumes as ResumeOption[]}
          onOpenPractice={({ app, customContext }) => {
            if (app) {
              setSelectedApp(app);
              setDetailTab("practice");
              setDetailOpen(true);
            } else if (customContext) {
              setSelectedApp({
                id: 0,
                title: customContext.title,
                company: customContext.company,
                job_description: customContext.job_description,
                resume_id: customContext.resume_id,
              });
              setDetailTab("practice");
              setDetailOpen(true);
            }
          }}
        />

        <RetrospectiveModal
          open={retroOpen}
          onOpenChange={setRetroOpen}
          app={retroApp}
          targetStage={retroTargetStage}
          isSaving={isSavingRetro}
          onSubmit={handleRetroSubmit}
        />

        <MilestoneModal
          open={milestoneOpen}
          onOpenChange={setMilestoneOpen}
          app={milestoneApp}
          stage={milestoneStage}
        />

        <CelebrationModal
          open={celebrationOpen}
          onOpenChange={setCelebrationOpen}
          app={celebrationApp}
        />

        <FeatureErrorBoundary sectionName="Application Details">
          <DetailModal
            open={detailOpen}
            onOpenChange={setDetailOpen}
            selectedApp={selectedApp}
            activeTab={detailTab}
            onTabChange={setDetailTab}
            onMilestone={openMilestoneModal}
            onCelebration={openCelebrationModal}
            onUpdateSelectedApp={setSelectedApp}
            onApplicationsInvalidate={() =>
              queryClient.invalidateQueries({ queryKey: ["applications"] })
            }
          />
        </FeatureErrorBoundary>
      </div>
    </AppShell>
  );
};

export default InterviewBoard;
