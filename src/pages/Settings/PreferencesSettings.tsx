import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Trash2, Loader2 } from "lucide-react";
import { exportUserData, deleteUserData, ApiError } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { JobWatchesCard } from "@/components/JobWatchesCard";
import { PreferenceProfileCard } from "@/components/PreferenceProfileCard";
import type { DisplayPreferences } from "./types";

export const PreferencesSettings: React.FC = () => {
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<DisplayPreferences>({
    compactView: false,
    autoSave: true,
  });

  // Export & Delete data state
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDataConfirm, setDeleteDataConfirm] = useState(false);
  const [deleteDataText, setDeleteDataText] = useState("");
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [deleteDataStatus, setDeleteDataStatus] = useState<{
    kind: "success" | "error";
    msg: string;
  } | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tayari-user-data-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Data Export Complete",
        description: "Downloaded your account data archive ZIP.",
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Failed to generate user data archive.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteData = async () => {
    if (deleteDataText !== "DELETE") {
      setDeleteDataStatus({ kind: "error", msg: "Please type DELETE to confirm data removal." });
      return;
    }
    setIsDeletingData(true);
    setDeleteDataStatus(null);
    try {
      await deleteUserData();
      setDeleteDataStatus({
        kind: "success",
        msg: "Your data deletion request has been processed.",
      });
      setDeleteDataConfirm(false);
      setDeleteDataText("");
    } catch (err) {
      setDeleteDataStatus({
        kind: "error",
        msg: err instanceof ApiError ? err.message : "Error processing data deletion.",
      });
    } finally {
      setIsDeletingData(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
          <CardDescription>Customize how Job Tayari looks and feels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            {
              key: "compactView" as const,
              label: "Compact View",
              description: "Use a more condensed layout",
            },
            {
              key: "autoSave" as const,
              label: "Auto-Save",
              description: "Automatically save changes while editing",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={preferences[item.key]}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, [item.key]: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
          <CardDescription>Manage your data and export options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Export Your Data</p>
              <p className="text-sm text-muted-foreground">
                Download all your resumes and application data
              </p>
            </div>
            <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export Data (ZIP)
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium text-foreground">Delete my data</p>
              <p className="text-sm text-muted-foreground">
                Erase your user-owned data (DELETE /v1/user/data). If data-only deletion is
                unavailable, your account is left untouched.
              </p>
              {deleteDataStatus && (
                <p
                  role={deleteDataStatus.kind === "error" ? "alert" : "status"}
                  className={`mt-1 text-xs font-medium ${
                    deleteDataStatus.kind === "error"
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {deleteDataStatus.msg}
                </p>
              )}
            </div>
            <Button variant="destructive" onClick={() => setDeleteDataConfirm((v) => !v)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete my data
            </Button>
          </div>
          {deleteDataConfirm && (
            <div className="p-4 rounded-lg border border-destructive bg-destructive/10 space-y-3 animate-fade-in">
              <p className="text-sm font-semibold text-destructive">Confirm data wipe</p>
              <div className="space-y-2">
                <Label htmlFor="delete-data-confirm-input" className="text-xs font-mono">
                  Type DELETE to confirm:
                </Label>
                <Input
                  id="delete-data-confirm-input"
                  value={deleteDataText}
                  onChange={(e) => setDeleteDataText(e.target.value)}
                  placeholder="DELETE"
                  className="bg-background text-sm font-mono border-destructive/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDataConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteDataText !== "DELETE" || isDeletingData}
                  onClick={handleDeleteData}
                >
                  {isDeletingData ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Confirm Data Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <JobWatchesCard />

      {/* M4 — learned career preference profile */}
      <PreferenceProfileCard />
    </div>
  );
};
