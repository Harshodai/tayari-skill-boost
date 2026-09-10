import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock,
  LogOut,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { USE_SELF_HOSTED } from "@/api/client";
import { changePasswordSchema } from "@/lib/schemas";
import { deleteUserAccount, changePassword, ApiError } from "@/api";
import type { PasswordData } from "./types";

export const SecuritySettings: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
      if (!user?.email || user.email.trim() === "") {
        throw new Error("Cannot verify current password: missing user email");
      }

      if (USE_SELF_HOSTED) {
        // Self-hosted users were never authenticated via Supabase Auth (the
        // Go gateway issues its own JWT), so supabase.auth.signInWithPassword
        // / updateUser always failed here with "Auth session missing!".
        // Verify + change the password through the Go gateway instead.
        await changePassword(passwordData.currentPassword, passwordData.newPassword);
      } else {
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: passwordData.currentPassword,
          });

          if (signInError) throw signInError;
        } catch (error) {
          console.error("Password verification failed:", error instanceof Error ? error.message : error);
          throw new Error("Incorrect current password");
        }

        const { error } = await supabase.auth.updateUser({
          password: passwordData.newPassword,
        });

        if (error) throw error;
      }

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast({
        title: "Verification Failed",
        description: "Please type DELETE to confirm account removal.",
        variant: "destructive",
      });
      return;
    }
    setIsDeletingAccount(true);
    try {
      await deleteUserAccount();
      toast({
        title: "Account Deleted",
        description: "Your account deletion request has been processed.",
      });

      try {
        await signOut();
      } catch {
        localStorage.removeItem("auth_token");
      }
    } catch (err) {
      const description =
        err instanceof ApiError ? err.message : "Error processing account deletion.";
      toast({ title: "Deletion Failed", description, variant: "destructive" });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
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
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
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
            <p className="text-xs text-muted-foreground">
              Min 8 chars, uppercase, lowercase, number, special char.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={passwordData.confirmPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, confirmPassword: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
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
            <Button variant="outline" disabled title="Coming soon" aria-disabled="true">
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
            <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>

          {deleteModalOpen && (
            <div className="p-4 rounded-lg border border-destructive bg-destructive/10 space-y-3 animate-fade-in">
              <p className="text-sm font-semibold text-destructive">Warning: Hard Cascade Wipe</p>
              <p className="text-xs text-muted-foreground">
                This action will immediately delete all your saved resumes, job applications,
                interview history, and account records. This action cannot be undone.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm-input" className="text-xs font-mono">
                  Type DELETE to confirm:
                </Label>
                <Input
                  id="delete-confirm-input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="bg-background text-sm font-mono border-destructive/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                  onClick={handleDeleteAccount}
                >
                  {isDeletingAccount ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Confirm Permanent Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
