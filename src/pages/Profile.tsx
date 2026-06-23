import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Edit,
  Save,
  X,
  MapPin,
  Loader2,
  Plus,
  X as XIcon,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfile, importProfilePDF } from "@/api";
import { toast } from "sonner";
import { useRef } from "react";

const Profile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  const [form, setForm] = useState({
    full_name: "",
    headline: "",
    summary: "",
    skills: [] as string[],
    desired_roles: [] as string[],
    locations: [] as string[],
    experience_years: 0,
    open_to_remote: false,
    links: {} as Record<string, string>,
  });

  const [skillInput, setSkillInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        headline: profile.headline || "",
        summary: profile.summary || "",
        skills: profile.skills || [],
        desired_roles: profile.desired_roles || [],
        locations: profile.locations || [],
        experience_years: profile.experience_years || 0,
        open_to_remote: profile.open_to_remote || false,
        links: (profile.links as Record<string, string>) || {},
      });
    }
  }, [profile]);

  const validate = (): boolean => {
    const errors: string[] = [];
    if (!form.full_name.trim()) errors.push("Full name is required");
    if (form.experience_years < 0) errors.push("Experience years must be positive");
    if (form.summary.length > 2000) errors.push("Summary must be under 2000 characters");
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Profile updated");
      setIsEditing(false);
      setValidationErrors([]);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: any) => {
      const msg = err.message || "Update failed";
      toast.error(msg);
    },
  });

  const handleSave = () => {
    if (!validate()) return;
    updateMutation.mutate(form);
  };

  const addItem = (key: "skills" | "desired_roles" | "locations", value: string) => {
    if (!value.trim()) return;
    setForm((prev) => ({
      ...prev,
      [key]: [...prev[key], value.trim()],
    }));
  };

  const removeItem = (key: "skills" | "desired_roles" | "locations", idx: number) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== idx),
    }));
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await importProfilePDF(file);
      // Merge imported data into form
      setForm((prev) => ({
        ...prev,
        headline: result.headline || prev.headline,
        skills: result.skills?.length ? result.skills : prev.skills,
        desired_roles: result.desired_roles?.length ? result.desired_roles : prev.desired_roles,
        locations: result.locations?.length ? result.locations : prev.locations,
      }));
      toast.success("Profile imported from resume! Review and save.");
      setIsEditing(true);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center mb-8">
            <Skeleton className="w-24 h-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card><CardContent className="py-6 space-y-3"><Skeleton className="h-5 w-20" /><Skeleton className="h-24 w-full" /></CardContent></Card>
              <Card><CardContent className="py-6 space-y-3"><Skeleton className="h-5 w-20" /><Skeleton className="h-12 w-full" /></CardContent></Card>
            </div>
            <div className="space-y-6">
              <Card><CardContent className="py-6 space-y-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-full" /></CardContent></Card>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Career Professional";
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const completionFields = [
    !!profile?.full_name,
    !!profile?.headline,
    !!profile?.summary,
    (profile?.skills?.length || 0) > 0,
    (profile?.desired_roles?.length || 0) > 0,
    (profile?.locations?.length || 0) > 0,
    (profile?.experience_years || 0) > 0,
  ];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  return (
    <AppShell title="Profile" subtitle="Your single source of truth — feeds every workflow">
      <div className="mb-6">
        {/* Living profile card */}
        <Card className="overflow-hidden">
          <div
            className="h-24 w-full"
            style={{ background: "linear-gradient(120deg, hsl(239 84% 60% / 0.18), hsl(175 70% 50% / 0.15), hsl(158 64% 42% / 0.12))" }}
          />
          <div className="px-5 md:px-7 pb-5 -mt-12">
            <div className="flex flex-col md:flex-row gap-5 md:items-end">
              {/* Avatar + completeness ring */}
              <div className="relative w-fit">
                <svg className="absolute -inset-2 w-[110px] h-[110px] -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" stroke="hsl(var(--border))" strokeWidth="4" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(completionPct / 100) * 289} 289`}
                  />
                </svg>
                <Avatar className="w-24 h-24 border-4 border-background relative">
                  <AvatarImage src={avatar} />
                  <AvatarFallback className="text-2xl bg-primary/15 text-primary">
                    {name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                  {completionPct}%
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  {name}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-0.5">
                  {profile?.headline || (profile as any)?.title || "Add a headline that summarizes your career goal"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {profile?.locations?.[0] || "Set location"}
                  </span>
                  {profile?.open_to_remote && (
                    <Badge variant="outline" className="text-[10px]">Open to remote</Badge>
                  )}
                  {(profile?.experience_years || 0) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {profile?.experience_years}+ yrs exp
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setValidationErrors([]); }}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf,.docx,.txt"
                      onChange={handleImportFile}
                    />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                      {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      Import resume
                    </Button>
                    <Button size="sm" onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {completionPct < 100 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Complete your profile to unlock sharper AI matches across Search, Optimizer, and Interview Prep.
          </p>
        )}
      </div>

        {/* Validation Errors */}
        {isEditing && validationErrors.length > 0 && (
          <div className="mb-6">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Please fix the following errors:</p>
                </div>
                <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                  {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Save Success Toast (inline backup) */}
        {updateMutation.isSuccess && !isEditing && (
          <div className="mb-6">
            <Card className="border-success/50 bg-success/5">
              <CardContent className="py-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <p className="text-sm font-medium text-success">Profile saved successfully</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
                <CardDescription>Your professional summary</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="Write a short professional summary..."
                    className="min-h-[120px]"
                  />
                ) : (
                  <p className="text-muted-foreground leading-relaxed">
                    {profile?.summary || "No summary yet. Add one to tell employers about yourself."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
                <CardDescription>Technologies and competencies</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditing && (
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Add a skill..."
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addItem("skills", skillInput);
                          setSkillInput("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        addItem("skills", skillInput);
                        setSkillInput("");
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {form.skills.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No skills added yet.</span>
                  ) : (
                    form.skills.map((skill, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {skill}
                        {isEditing && (
                          <XIcon
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => removeItem("skills", idx)}
                          />
                        )}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Desired Roles</CardTitle>
                <CardDescription>Target job titles</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditing && (
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Add a role..."
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addItem("desired_roles", roleInput);
                          setRoleInput("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        addItem("desired_roles", roleInput);
                        setRoleInput("");
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {form.desired_roles.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No roles added yet.</span>
                  ) : (
                    form.desired_roles.map((role, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        {role}
                        {isEditing && (
                          <XIcon
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => removeItem("desired_roles", idx)}
                          />
                        )}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Experience (years)</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={form.experience_years}
                      onChange={(e) => setForm({ ...form, experience_years: Number(e.target.value) })}
                    />
                  ) : (
                    <p className="text-muted-foreground">{form.experience_years || 0} years</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Locations</label>
                  {isEditing && (
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Add location..."
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addItem("locations", locationInput);
                            setLocationInput("");
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          addItem("locations", locationInput);
                          setLocationInput("");
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {form.locations.map((loc, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {loc}
                        {isEditing && (
                          <XIcon
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => removeItem("locations", idx)}
                          />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Open to Remote</span>
                  {isEditing ? (
                    <Switch
                      checked={form.open_to_remote}
                      onCheckedChange={(v) => setForm({ ...form, open_to_remote: v })}
                    />
                  ) : (
                    <Badge variant={form.open_to_remote ? "default" : "outline"}>
                      {form.open_to_remote ? "Yes" : "No"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </AppShell>
  );
};

export default Profile;
