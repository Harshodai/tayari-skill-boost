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
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { profileSchema, changePasswordSchema } from "@/lib/schemas";
import { z } from "zod";
import { PreferenceProfileCard } from "@/components/PreferenceProfileCard";

const Settings = () => {
  const { user, session, signOut } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Integrations states
  const [copiedToken, setCopiedToken] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    const token = session?.access_token || localStorage.getItem('auth_token');
    if (!token) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
    fetch(`${API_URL}/gmail/status`, {
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
    const backendUrl = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace(/\/api$/, "");
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
    const backendUrl = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace(/\/api$/, "");
    const deepLink = `hermes://mcp/register?name=JobTheory&url=${encodeURIComponent(backendUrl)}&token=${encodeURIComponent(token)}`;
    window.location.href = deepLink;
    toast({
      title: "Opening Hermes Desktop",
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
        description: validation.error.errors[0].message,
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
        description: validation.error.errors[0].message,
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
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    disabled
                    title="Coming soon"
                    aria-disabled="true"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                    <Info className="w-3 h-3 ml-1 opacity-50" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Manage your subscription and billing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-6 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Free Plan</h3>
                      <p className="text-muted-foreground">Basic features for getting started</p>
                    </div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-lg px-4 py-1">
                      $0/month
                    </Badge>
                  </div>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• 3 resume optimizations per month</li>
                    <li>• Basic AI suggestions</li>
                    <li>• 2 resume templates</li>
                  </ul>
                  <Button className="mt-6 w-full" variant="glow">
                    Upgrade to Pro
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Payment Method</h4>
                  <p className="text-muted-foreground text-sm">No payment method on file</p>
                  <Button variant="outline">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
                          const token = session?.access_token || localStorage.getItem('auth_token');
                          try {
                            const res = await fetch(`${API_URL}/gmail/login`, {
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
                <CardTitle>Hermes Desktop Integration</CardTitle>
                <CardDescription>
                  Configure local autonomous agents (Hermes Desktop/Claude Desktop) to control your Job Tayari board
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Your Personal Access Token</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use this token to authenticate your local Hermes Agent. Keep it private.
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
                          Download a pre-configured settings file ready to copy into your local Hermes Desktop directory.
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
                          Directly initiate a registration request inside your locally running Hermes Desktop client.
                        </p>
                      </div>
                      <Button onClick={handleOpenHermes} variant="outline" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in Hermes Desktop
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
        "JOBTHEORY_URL": "${(import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '')}",
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