import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Briefcase,
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Loader2,
  Target,
  RotateCcw,
  AlertCircle,
  Brain,
  Mail,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "@/api";
import { useNavigate } from "react-router-dom";

const COLUMNS = [
  { id: "saved", label: "Saved", color: "bg-muted" },
  { id: "applied", label: "Applied", color: "bg-primary/10" },
  { id: "phone_screen", label: "Phone Screen", color: "bg-secondary/10" },
  { id: "interview", label: "Interview", color: "bg-warning/10" },
  { id: "offer", label: "Offer", color: "bg-success/10" },
  { id: "rejected", label: "Rejected", color: "bg-destructive/10" },
];

const InterviewBoard = () => {
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [optimisticApps, setOptimisticApps] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });

  const createMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      toast.success("Application added");
      setDialogOpen(false);
      setNewJobTitle("");
      setNewCompany("");
      setNewLocation("");
      setNewUrl("");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to add"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateApplication(id, { status }),
    onSuccess: (_, vars) => {
      setOptimisticApps((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any, vars) => {
      setOptimisticApps((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      toast.error(err.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const handleAdd = () => {
    if (!newJobTitle.trim() || !newCompany.trim()) return;
    createMutation.mutate({
      job: { title: newJobTitle, company: newCompany, location: newLocation, url: newUrl },
      status: "saved",
    });
  };

  const move = (app: any, direction: "left" | "right") => {
    const idx = COLUMNS.findIndex((c) => c.id === app.status);
    const nextIdx = direction === "left" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return;
    const nextStatus = COLUMNS[nextIdx].id;
    setOptimisticApps((prev) => ({ ...prev, [app.application_id]: nextStatus }));
    updateMutation.mutate({ id: app.application_id, status: nextStatus });
  };

  const effectiveStatus = (app: any) => optimisticApps[app.application_id] || app.status;
  const appsByColumn = (status: string) => applications.filter((a) => effectiveStatus(a) === status);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Interview Kanban Board
            </h1>
            <p className="text-muted-foreground">
              Track your job applications from saved to offer.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Application
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Application</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Job Title</label>
                  <Input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g. Software Engineer" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Company</label>
                  <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Google" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Location</label>
                  <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Remote" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Apply URL</label>
                  <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="mb-6">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Failed to load applications</p>
                  <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["applications"] })}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col">
                <div className={`p-3 rounded-t-lg ${col.color} border-x border-t border-border flex items-center justify-between`}>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-6" />
                </div>
                <div className="flex-1 bg-card border-x border-b border-border rounded-b-lg p-2 space-y-3 min-h-[200px]">
                  <Card className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </Card>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col">
                <div className={`p-3 rounded-t-lg ${col.color} border-x border-t border-border flex items-center justify-between`}>
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {appsByColumn(col.id).length}
                  </Badge>
                </div>
                <div className="flex-1 bg-card border-x border-b border-border rounded-b-lg p-2 space-y-3 min-h-[200px]">
                  {appsByColumn(col.id).map((app) => {
                    const isMoving = !!optimisticApps[app.application_id];
                    return (
                      <Card key={app.application_id} className={`card-hover ${isMoving ? "opacity-60" : ""}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium truncate">
                                {app.job?.title || "Untitled"}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {app.job?.company || "Unknown"}
                              </p>
                              {app.job?.location && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {app.job.location}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={col.id === COLUMNS[0].id || isMoving}
                                onClick={() => move(app, "left")}
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={col.id === COLUMNS[COLUMNS.length - 1].id || isMoving}
                                onClick={() => move(app, "right")}
                              >
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteMutation.mutate(app.application_id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(col.id === "phone_screen" || col.id === "interview") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => navigate(`/interview/prep?app=${app.application_id}`)}
                              >
                                <Brain className="w-3 h-3 mr-1" />
                                Prep
                              </Button>
                            )}
                            {col.id === "saved" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => navigate(`/cover-letter?app=${app.application_id}`)}
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Cover Letter
                              </Button>
                            )}
                            {col.id !== "saved" && col.id !== "rejected" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => navigate(`/communication?app=${app.application_id}`)}
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Comms
                              </Button>
                            )}
                          </div>

                          {app.ats_score_after > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <Target className="w-3 h-3" />
                              ATS: {app.ats_score_after}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InterviewBoard;
