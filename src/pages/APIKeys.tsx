import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { listAPIKeys, createAPIKey, revokeAPIKey, getAPIKeyUsage } from "@/api";
import { Key, Copy, Trash2, Eye, EyeOff, Plus, Loader2, Clock, Activity } from "lucide-react";

const APIKeys = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [visibleUsage, setVisibleUsage] = useState<number | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => listAPIKeys(),
  });

  const { data: usageData } = useQuery({
    queryKey: ["api-key-usage", visibleUsage],
    queryFn: () => getAPIKeyUsage(visibleUsage!),
    enabled: visibleUsage !== null,
  });

  const createMut = useMutation({
    mutationFn: () => createAPIKey(newKeyName),
    onSuccess: (data) => {
      setCreatedKey(data.raw_key);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create key"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => revokeAPIKey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
    },
    onError: (err: any) => toast.error(err.message || "Failed to revoke key"),
  });

  const handleCopy = (rawKey?: string) => {
    if (!rawKey) return;
    navigator.clipboard.writeText(rawKey);
    toast.success("Copied!");
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage keys for programmatic resume optimization and ATS analysis.
            </p>
          </div>
          <Button onClick={() => { setShowCreate(true); setNewKeyName(""); setCreatedKey(null); }}>
            <Plus className="w-4 h-4 mr-2" /> New Key
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Key className="w-10 h-10 mx-auto mb-4 text-muted-foreground/60" />
              <h3 className="font-semibold mb-1">No API Keys</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Create an API key to integrate resume optimization into your own applications and workflows.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {keys.map((k: any) => (
              <Card key={k.id} className={k.is_active ? "" : "opacity-60"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Key className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{k.name}</span>
                        <Badge variant={k.is_active ? "default" : "secondary"} className="text-[10px]">
                          {k.is_active ? "Active" : "Revoked"}
                        </Badge>
                      </div>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{k.key_prefix}...</code>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created {new Date(k.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : "Never used"}
                        </span>
                        <span>{k.rate_limit} req/min</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVisibleUsage(visibleUsage === k.id ? null : k.id)}
                      >
                        {visibleUsage === k.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      {k.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => revokeMut.mutate(k.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {visibleUsage === k.id && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Recent Usage
                      </h4>
                      {usageData && usageData.length > 0 ? (
                        <div className="space-y-1">
                          {usageData.slice(0, 10).map((u: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
                              <Badge variant={u.status_code < 400 ? "default" : "destructive"} className="text-[10px] py-0">
                                {u.status_code}
                              </Badge>
                              <code className="flex-1 truncate">{u.endpoint}</code>
                              <span>{u.response_ms}ms</span>
                              <span>{new Date(u.created_at).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No usage recorded yet.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            {createdKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Copy this key now. You will not be able to see it again.
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-muted rounded-lg p-4 my-4">
                  <code className="text-xs break-all font-mono">{createdKey}</code>
                </div>
                <DialogFooter>
                  <Button onClick={() => handleCopy(createdKey)}>
                    <Copy className="w-4 h-4 mr-2" /> Copy Key
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Give your key a name to remember what it's used for.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <label className="text-sm font-medium mb-1 block">Key Name</label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production CLI tool"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button
                    onClick={() => createMut.mutate()}
                    disabled={!newKeyName.trim() || createMut.isPending}
                  >
                    {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
};

export default APIKeys;
