import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Download, ExternalLink, Eye, EyeOff, Check, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { API_URL, apiFetchResponse } from "@/api";
import { GoogleWorkspaceConnectCard } from "@/components/GoogleWorkspaceConnectCard";
import { features } from "@/config/features";

export const IntegrationsSettings: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();

  const [copiedToken, setCopiedToken] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    const token = session?.access_token || localStorage.getItem("auth_token");
    if (!token) return;
    apiFetchResponse(`/gmail/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.connected) {
          setGmailConnected(true);
        }
      })
      .catch((err) => console.error("Error fetching Gmail status:", err));
  }, [session]);

  const handleDownloadMcpConfig = () => {
    const token = session?.access_token || localStorage.getItem("auth_token") || "";
    const backendUrl = API_URL.replace(/\/api$/, "");
    const config = {
      mcpServers: {
        jobtheory: {
          command: "python",
          args: ["/absolute/path/to/tayari-skill-boost/integrations/jobtheory_mcp/server.py"],
          env: {
            JOBTHEORY_URL: backendUrl,
            JOBTHEORY_TOKEN: token,
          },
        },
      },
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mcp.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Configuration Downloaded",
      description:
        "mcp.json has been downloaded. Update the command arguments to point to your local path.",
    });
  };

  const handleCopyToken = () => {
    const token = session?.access_token || localStorage.getItem("auth_token") || "";
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    toast({
      title: "Token Copied",
      description: "Personal access token copied to clipboard.",
    });
  };

  const handleOpenHermes = () => {
    const backendUrl = API_URL.replace(/\/api$/, "");
    const deepLink = `hermes://mcp/register?name=JobTheory&url=${encodeURIComponent(backendUrl)}`;
    window.location.href = deepLink;
    toast({
      title: "Opening Desktop Agent",
      description: "Initiating native companion registration request...",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Gmail Integration</CardTitle>
          <CardDescription>
            Automatically synchronize your applications from email conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Gmail Inbox Sync</p>
              <p className="text-sm text-muted-foreground">
                {gmailConnected
                  ? "Connected. Job Tayari is actively parsing relevant recruitment emails."
                  : "Disconnected. Connect to authorize automatic parsing of interview requests."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {gmailConnected ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  Active
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const token = session?.access_token || localStorage.getItem("auth_token");
                    try {
                      const res = await apiFetchResponse(`/gmail/login`, {
                        method: "GET",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: "application/json",
                        },
                      });
                      if (!res.ok)
                        throw new Error(`Failed to start Gmail OAuth (HTTP ${res.status})`);
                      const data = await res.json();
                      if (!data?.auth_url) throw new Error("Missing auth_url in response");
                      window.location.href = data.auth_url;
                    } catch (err: unknown) {
                      console.error("Gmail login failed", err);
                      const msg = err instanceof Error ? err.message : "Failed to start Gmail OAuth";
                      alert(msg);
                    }
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Connect Gmail
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Google Workspace Extensions</CardTitle>
          <CardDescription>
            Candidate-controlled, read-only connections for interview scheduling and document metadata.
            Each service requires separate consent and can be revoked independently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleWorkspaceConnectCard service="calendar" enabled={features.googleCalendar} />
          <GoogleWorkspaceConnectCard service="drive" enabled={features.googleDrive} />
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Desktop Agent Integration</CardTitle>
          <CardDescription>
            Configure local autonomous agents (Job Tayari Desktop Agent, Claude Desktop) to control your Job Tayari board
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Your Personal Access Token</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Use this token to authenticate your local Desktop Agent. Keep it private — it is
                  masked by default and never included in links.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type={revealToken ? "text" : "password"}
                    value={session?.access_token || localStorage.getItem("auth_token") || ""}
                    readOnly
                    className="font-mono text-sm opacity-80"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRevealToken(!revealToken)}
                  >
                    {revealToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopyToken}>
                    {copiedToken ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Download mcp.json</h4>
                  <p className="text-sm text-muted-foreground">
                    Download a pre-configured settings file ready to copy into your local Desktop Agent
                    directory.
                  </p>
                </div>
                <Button onClick={handleDownloadMcpConfig} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download Config
                </Button>
              </div>

              <div className="p-4 rounded-lg border border-border space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Deep Link Registration</h4>
                  <p className="text-sm text-muted-foreground">
                    Directly initiate a registration request inside your locally running Desktop
                    Agent client.
                  </p>
                </div>
                <Button onClick={handleOpenHermes} variant="outline" className="w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Desktop Agent
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Manual Config Registration</h4>
            <p className="text-sm text-muted-foreground">
              This shows the shape of the config block — the token below is truncated for display and
              will not authenticate if pasted as-is. Use "Download Config" above for a ready-to-use
              `mcp.json` with your real token, then edit the file path to match your local checkout.
            </p>
            <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto border border-border">
{`{
  "mcpServers": {
    "jobtheory": {
      "command": "python",
      "args": ["/absolute/path/to/tayari-skill-boost/integrations/jobtheory_mcp/server.py"],
      "env": {
        "JOBTHEORY_URL": "${API_URL.replace(/\/api$/, '')}",
        "JOBTHEORY_TOKEN": "${(session?.access_token || localStorage.getItem('auth_token') || '').substring(0, 15)}..."
      }
    }
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
