import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Lock,
  Bell,
  Palette,
  Shield,
  CreditCard,
  Download,
  Trash2,
  Camera,
  Save,
  LogOut,
  Smartphone,
  Globe,
  Eye,
  EyeOff,
  Loader2,
  Info,
  Copy,
  Check,
  ExternalLink,
  Coins,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL, apiFetch, apiFetchResponse, exportUserData, deleteUserAccount, ApiError } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { profileSchema, changePasswordSchema } from "@/lib/schemas";
import { z } from "zod";
import { PreferenceProfileCard } from "@/components/PreferenceProfileCard";
import { JobWatchesCard } from "@/components/JobWatchesCard";
import { GoogleWorkspaceConnectCard } from "@/components/GoogleWorkspaceConnectCard";
import { features } from "@/config/features";
import { Link } from "react-router-dom";

// ─── BillingTab: live credit balance and transaction history ─────────────────
function BillingTab() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [lifetimePurchased, setLifetimePurchased] = useState<number>(0);
  const [lifetimeUsed, setLifetimeUsed] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<any>("/v1/billing/credits")
      .then((res) => {
        setBalance(typeof res?.balance === "number" ? res.balance : 0);
        setLifetimePurchased(typeof res?.lifetime_purchased === "number" ? res.lifetime_purchased : 0);
        setLifetimeUsed(typeof res?.lifetime_used === "number" ? res.lifetime_used : 0);
        setHistory(Array.isArray(res?.history) ? res.history : []);
      })
      .catch((err) => setError(err?.message || "Could not load billing data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <Card className="animate-fade-in-up">
        <CardContent className="py-10 flex items-center justify-center gap-3 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading billing data…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="animate-fade-in-up border-destructive/40 bg-destructive/5">
        <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" /> Verified Submission Credits
          </CardTitle>
          <CardDescription>1 credit is debited only when a verified ATS submission receipt is generated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-3xl font-extrabold tabular-nums text-primary">{balance}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Available</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-3xl font-extrabold tabular-nums">{lifetimePurchased}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Purchased (lifetime)</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-3xl font-extrabold tabular-nums text-success">{lifetimeUsed}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Used (verified subs)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20 text-sm">
            <ShieldCheck className="w-4 h-4 text-success shrink-0" />
            <span className="text-muted-foreground">
              Credits never expire. Failed or unverifiable applications cost <strong>$0.00 / 0 credits</strong>.
            </span>
          </div>

          <div className="flex gap-3">
            <Button asChild className="flex-1" variant="glow">
              <Link to="/pricing">Buy More Credits</Link>
            </Button>
            <Button variant="outline" size="icon" onClick={load} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" /> Transaction History
          </CardTitle>
          <CardDescription>Every credit purchase and debit with reference and date</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet. Purchase a credit pack to get started.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {history.map((tx: any, i: number) => (
                <div key={tx.id ?? i} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description || (tx.type === "debit" ? "Verified Submission" : "Credit Pack Purchase")}
                    </p>
                    {tx.reference_id && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">ref: {tx.reference_id}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-sm font-bold tabular-nums ${tx.type === "debit" ? "text-destructive" : "text-success"}`}>
                      {tx.type === "debit" ? "-" : "+"}{Math.abs(tx.amount ?? tx.credits ?? 0)} cr
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────


const Settings = () => {
  const { user, session, signOut } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Export & Delete state
  const [isExporting, setIsExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tayari-user-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Data Export Complete", description: "Downloaded your account data archive JSON." });
    } catch {
      toast({ title: "Export Failed", description: "Failed to generate user data archive.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast({ title: "Verification Failed", description: "Please type DELETE to confirm account removal.", variant: "destructive" });
      return;
    }
    setIsDeletingAccount(true);
    try {
      await deleteUserAccount();
      toast({ title: "Account Deleted", description: "Your account deletion request has been processed." });

      // ponytail: sign-out is independent of deletion success. A rejection here
      // must not overwrite the "Account Deleted" toast with "Deletion Failed".
      try {
        await signOut();
      } catch {
        localStorage.removeItem('auth_token');
      }
    } catch (err) {
      // ponytail: the backend distinguishes "nothing happened" from "your
      // data was deleted but auth-identity revocation failed" (see
      // routes_account.go) -- surface its real message instead of a generic
      // one, since a user who was actually mostly-deleted needs to know that,
      // not just that "an error" occurred.
      const description = err instanceof ApiError ? err.message : "Error processing account deletion.";
      toast({ title: "Deletion Failed", description, variant: "destructive" });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Integrations states

  const [copiedToken, setCopiedToken] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    const token = session?.access_token || localStorage.getItem('auth_token');
    if (!token) return;
    apiFetchResponse(`/gmail/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.connected) {
          setGmailConnected(true);
        }
      })
      .catch(err => console.error("Error fetching Gmail status:", err));
  }, [session]);

  const handleDownloadMcpConfig = () => {
    const token = session?.access_token || localStorage.getItem('auth_token') || "";
    const backendUrl = API_URL.replace(/\/api$/, "");
    const config = {
      mcpServers: {
        jobtheory: {
          command: "python",
          args: ["/absolute/path/to/tayari-skill-boost/integrations/jobtheory_mcp/server.py"],
          env: {
            JOBTHEORY_URL: backendUrl,
            JOBTHEORY_TOKEN: token
          }
        }
      }
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
      description: "mcp.json has been downloaded. Update the command arguments to point to your local path.",
    });
  };

  const handleCopyToken = () => {
    const token = session?.access_token || localStorage.getItem('auth_token') || "";
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    toast({
      title: "Token Copied",
      description: "Personal access token copied to clipboard.",
    });
  };

  const handleOpenHermes = () => {
    const token = session?.access_token || localStorage.getItem('auth_token') || "";
    const backendUrl = API_URL.replace(/\/api$/, "");
    const deepLink = `hermes://mcp/register?name=JobTheory&url=${encodeURIComponent(backendUrl)}&token=${encodeURIComponent(token)}`;
    window.location.href = deepLink;
    toast({
      title: "Opening Desktop Agent",
      description: "Initiating native companion registration request...",
    });
  };

  // Form states
  const [profileData, setProfileData] = useState({
    name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "",
    email: user?.email || "",
    phone: user?.user_metadata?.phone || "",
    location: user?.user_metadata?.location || "",
    bio: user?.user_metadata?.bio || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    applicationAlerts: true,
    weeklyDigest: false,
    marketingEmails: false,
  });

  const [preferences, setPreferences] = useState({
    compactView: false,
    autoSave: true,
  });

  const handleSaveProfile = async () => {
    setIsLoading(true);
    const validation = profileSchema.safeParse(profileData);

    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.issues[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.name,
          name: profileData.name, // Support both keys
          phone: profileData.phone,
          location: profileData.location,
          bio: profileData.bio
        }
      });

      if (authError) throw authError;

      // Update Profiles Table (if exists and synced)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (profileError) {
        console.warn("Profile table update failed:", profileError);
        // Don't block success if auth update worked, but log it
      }

      toast({
        title: "Profile Updated",
        description: "Your profile changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setIsLoading(true);
    const validation = changePasswordSchema.safeParse(passwordData);

    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.issues[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Verify current password first
      // Verify current password first
      if (!user?.email || user.email.trim() === "") {
        throw new Error("Cannot verify current password: missing user email");
      }

      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwordData.currentPassword,
        });

        if (signInError) throw signInError;
      } catch (error) {
        // Log detailed error for debugging, but show generic message to user
        console.error("Password verification failed:", error instanceof Error ? error.message : error);
        throw new Error("Incorrect current password");
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notification Preferences Updated",
      description: "Your notification settings have been saved locally (Demo).",
    });
  };

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border w-full justify-start flex-wrap h-auto gap-2 p-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Palette className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Globe className="w-4 h-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                      <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                        {getInitials(profileData.name || "U")}
                      </AvatarFallback>
                    </Avatar>
                    <button className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{profileData.name || "User"}</h3>
                    <p className="text-muted-foreground text-sm">{profileData.email}</p>
                    <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">Free Plan</Badge>
                  </div>
                </div>

                <Separator />

                {/* Form Fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                      className="opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      placeholder="San Francisco, CA"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Input
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      placeholder="Tell us a bit about yourself"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    key: "emailUpdates",
                    label: "Email Updates",
                    description: "Receive updates about your resume analysis",
                    icon: Mail,
                  },
                  {
                    key: "applicationAlerts",
                    label: "Application Alerts",
                    description: "Get notified when there's activity on your applications",
                    icon: Bell,
                  },
                  {
                    key: "weeklyDigest",
                    label: "Weekly Digest",
                    description: "Receive a weekly summary of your job search progress",
                    icon: Globe,
                  },
                  {
                    key: "marketingEmails",
                    label: "Marketing Emails",
                    description: "Receive tips, news, and special offers",
                    icon: Smartphone,
                  },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications[item.key as keyof typeof notifications]}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, [item.key]: checked })
                      }
                    />
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveNotifications}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter current password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Min 8 chars, uppercase, lowercase, number, special char.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions for your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-foreground">Sign Out of All Devices</p>
                    <p className="text-sm text-muted-foreground">
                      This will sign you out of all devices except this one
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled
                    title="Coming soon"
                    aria-disabled="true"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out All
                    <Info className="w-3 h-3 ml-1 opacity-50" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div>
                    <p className="font-medium text-foreground">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteModalOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </div>

                {deleteModalOpen && (
                  <div className="p-4 rounded-lg border border-destructive bg-destructive/10 space-y-3 animate-fade-in">
                    <p className="text-sm font-semibold text-destructive">
                      Warning: Hard Cascade Wipe
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This action will immediately delete all your saved resumes, job applications, interview history, and account records. This action cannot be undone.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="delete-confirm-input" className="text-xs font-mono">Type DELETE to confirm:</Label>
                      <Input
                        id="delete-confirm-input"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="bg-background text-sm font-mono border-destructive/50"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                        onClick={handleDeleteAccount}
                      >
                        {isDeletingAccount ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                        Confirm Permanent Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <BillingTab />
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Display Preferences</CardTitle>
                <CardDescription>Customize how Job Tayari looks and feels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    key: "compactView",
                    label: "Compact View",
                    description: "Use a more condensed layout",
                  },
                  {
                    key: "autoSave",
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
                      checked={preferences[item.key as keyof typeof preferences]}
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
                    {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    Export Data (JSON)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <JobWatchesCard />

            {/* M4 — learned career preference profile */}
            <PreferenceProfileCard />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
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
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Active
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={async () => {
                                                const token = session?.access_token || localStorage.getItem('auth_token');
                          try {
                            const res = await apiFetchResponse(`/gmail/login`, {
                              method: 'GET',
                              headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: 'application/json',
                              },
                            });
                            if (!res.ok) throw new Error(`Failed to start Gmail OAuth (HTTP ${res.status})`);
                            const data = await res.json();
                            if (!data?.auth_url) throw new Error('Missing auth_url in response');
                            window.location.href = data.auth_url;
                          } catch (err: any) {
                            console.error('Gmail login failed', err);
                            alert(err?.message || 'Failed to start Gmail OAuth');
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
                  Candidate-controlled, read-only connections for interview scheduling and document metadata. Each service requires separate consent and can be revoked independently.
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
                        Use this token to authenticate your local Desktop Agent. Keep it private.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type={revealToken ? "text" : "password"}
                          value={session?.access_token || localStorage.getItem('auth_token') || ""}
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
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyToken}
                        >
                          {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border border-border space-y-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Download mcp.json</h4>
                        <p className="text-sm text-muted-foreground">
                          Download a pre-configured settings file ready to copy into your local Desktop Agent directory.
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
                          Directly initiate a registration request inside your locally running Desktop Agent client.
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
                    To manually integrate Job Tayari with Claude Desktop or Cursor, append this block to your local `mcp.json` file:
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
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Settings;