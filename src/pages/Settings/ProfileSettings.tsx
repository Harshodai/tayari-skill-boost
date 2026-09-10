import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Camera, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { profileSchema } from "@/lib/schemas";
import type { ProfileData } from "./types";

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "",
    email: user?.email || "",
    phone: user?.user_metadata?.phone || "",
    location: user?.user_metadata?.location || "",
    bio: user?.user_metadata?.bio || "",
  });

  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.name,
          name: profileData.name,
          phone: profileData.phone,
          location: profileData.location,
          bio: profileData.bio,
        },
      });

      if (authError) throw authError;

      // Update Profiles Table (if exists and synced)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        console.warn("Profile table update failed:", profileError);
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

  return (
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
              placeholder="Full Name"
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
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
