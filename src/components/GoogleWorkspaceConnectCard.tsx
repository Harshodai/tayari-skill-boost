import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, ExternalLink, FileText, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  disconnectGoogleCalendar,
  disconnectGoogleDrive,
  getGoogleCalendarLogin,
  getGoogleCalendarStatus,
  getGoogleDriveLogin,
  getGoogleDriveStatus,
  syncGoogleCalendar,
  syncGoogleDrive,
  type GoogleWorkspaceStatusResponse,
} from "@/api/dashboard";

type GoogleWorkspaceService = "calendar" | "drive";

interface GoogleWorkspaceConnectCardProps {
  service: GoogleWorkspaceService;
  enabled: boolean;
}

const serviceConfig = {
  calendar: {
    title: "Google Calendar",
    description: "Read upcoming interview and recruiting events without creating or changing Calendar events.",
    scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    icon: CalendarDays,
    getStatus: getGoogleCalendarStatus,
    getLogin: getGoogleCalendarLogin,
    sync: syncGoogleCalendar,
    disconnect: disconnectGoogleCalendar,
  },
  drive: {
    title: "Google Drive",
    description: "Read metadata for candidate-selected resumes and cover letters without editing or downloading files automatically.",
    scope: "https://www.googleapis.com/auth/drive.metadata.readonly",
    icon: FileText,
    getStatus: getGoogleDriveStatus,
    getLogin: getGoogleDriveLogin,
    sync: syncGoogleDrive,
    disconnect: disconnectGoogleDrive,
  },
} as const;

export const GoogleWorkspaceConnectCard: React.FC<GoogleWorkspaceConnectCardProps> = ({ service, enabled }) => {
  const config = serviceConfig[service];
  const Icon = config.icon;
  const [status, setStatus] = useState<GoogleWorkspaceStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!enabled) return;
    try {
      setError(null);
      setStatus(await config.getStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to load ${config.title} status.`);
    }
  }, [config, enabled]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const connect = async () => {
    try {
      setBusy(true);
      setError(null);
      const response = await config.getLogin();
      if (!response.auth_url) throw new Error("Google did not return an authorization URL.");
      window.location.assign(response.auth_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to start ${config.title} authorization.`);
      setBusy(false);
    }
  };

  const sync = async () => {
    try {
      setBusy(true);
      setError(null);
      await config.sync();
      setLastSync(new Date().toLocaleString());
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${config.title} sync failed.`);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    try {
      setBusy(true);
      setError(null);
      await config.disconnect();
      setStatus((current) => current ? { ...current, connected: false } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to disconnect ${config.title}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">{config.title}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        {enabled && status?.connected && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
          </Badge>
        )}
      </div>

      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Consent and data boundary</p>
        <p>JobTayari requests exactly one read-only Google scope:</p>
        <code className="block break-all text-[11px] text-foreground">{config.scope}</code>
        <p>It does not create, edit, share, delete, send, or submit anything in Google Workspace. You can disconnect at any time; imported records remain marked with their Google provenance.</p>
      </div>

      {!enabled ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          This connector is disabled by the current release scope until staging provider and privacy evidence is complete.
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!status?.connected ? (
              <Button variant="outline" onClick={connect} disabled={busy || status?.enabled === false}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                Connect {config.title}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={sync} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sync read-only data
                </Button>
                <Button variant="ghost" onClick={disconnect} disabled={busy}>
                  <Unplug className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              </>
            )}
            {lastSync && <span className="text-xs text-muted-foreground">Last sync: {lastSync}</span>}
          </div>
        </>
      )}
    </div>
  );
};
