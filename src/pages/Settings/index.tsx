import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, CreditCard, Palette, Globe } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettings } from "./ProfileSettings";
import { NotificationSettings } from "./NotificationSettings";
import { SecuritySettings } from "./SecuritySettings";
import { BillingSettings } from "./BillingSettings";
import { PreferencesSettings } from "./PreferencesSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";

const VALID_TABS = ["profile", "notifications", "security", "billing", "preferences", "integrations"];

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : "profile"
  );

  // OAuth connect flows (e.g. Gmail) redirect back here with ?tab=integrations
  // and a result flag — surface it once, then drop it from the URL so a
  // refresh doesn't replay the toast.
  useEffect(() => {
    const gmailResult = searchParams.get("gmail");
    if (!gmailResult) return;
    if (gmailResult === "connected") toast.success("Gmail connected");
    else if (gmailResult === "denied") toast.info("Gmail connection cancelled");
    else toast.error("Gmail connection failed. Please try again.");
    const next = new URLSearchParams(searchParams);
    next.delete("gmail");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and settings</p>
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

          <TabsContent value="profile" className="space-y-6">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <BillingSettings />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <PreferencesSettings />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <IntegrationsSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Settings;
