import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Mail, Bell, Zap, Smartphone, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getHermesDigestPreferences,
  setHermesDigestPreferences,
  toggleHermesDigest,
  HERMES_DIGEST_STORAGE_KEY,
} from "@/lib/hermesDigest";
import type { NotificationPreferences } from "./types";

export const NotificationSettings: React.FC = () => {
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<NotificationPreferences>(() => {
    const hermes = getHermesDigestPreferences();
    let saved: Partial<NotificationPreferences> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("tayari_notification_preferences");
        if (raw) saved = JSON.parse(raw);
      } catch {
        /* storage unavailable or parse error */
      }
    }
    return {
      emailUpdates: saved.emailUpdates ?? true,
      applicationAlerts: saved.applicationAlerts ?? true,
      weeklyDigest: (() => {
        const hermesRecordExists =
          typeof window !== "undefined" &&
          localStorage.getItem(HERMES_DIGEST_STORAGE_KEY) !== null;
        return hermesRecordExists ? hermes.enabled : saved.weeklyDigest ?? false;
      })(),
      marketingEmails: saved.marketingEmails ?? false,
    };
  });

  const handleNotificationToggle = (key: keyof NotificationPreferences, checked: boolean) => {
    const next = { ...notifications, [key]: checked };
    setNotifications(next);
    if (key === "weeklyDigest") {
      const res = toggleHermesDigest(checked);
      toast({
        title: res.toastMessage,
        description: res.toastDescription,
      });
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("tayari_notification_preferences", JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    }
  };

  const handleSaveNotifications = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "tayari_notification_preferences",
          JSON.stringify(notifications)
        );
        const currentHermesPrefs = getHermesDigestPreferences();
        setHermesDigestPreferences({
          enabled: notifications.weeklyDigest,
          filters: currentHermesPrefs.filters,
          day: currentHermesPrefs.day,
          frequency: currentHermesPrefs.frequency,
        });
      } catch {
        /* storage unavailable */
      }
    }
    toast({
      title: "Notification Preferences Saved",
      description: notifications.weeklyDigest
        ? "Weekly Hermes Job Digest is active. You will receive scanned ATS matches every Tuesday."
        : "Preferences saved locally. Email delivery for these categories isn't built yet.",
    });
  };

  // ponytail: only weeklyDigest is wired to a real backend feature
  // (toggleHermesDigest, a genuine scheduled scan). The other three keys
  // are stored in localStorage only — no backend code anywhere reads
  // emailUpdates/applicationAlerts/marketingEmails, and the app's live
  // notification path (notify_user in notifications.py) writes in-app
  // rows unconditionally and never sends email; the one function that
  // would honor an email preference (process_notification_event) has zero
  // callers. Copy below is worded to not promise email delivery this app
  // doesn't currently perform for these categories.
  const notificationItems = [
    {
      key: "emailUpdates" as const,
      label: "Email Updates",
      description: "Saved as a local preference. Email delivery for resume-analysis updates is not yet built — activity currently only appears in-app.",
      icon: Mail,
    },
    {
      key: "applicationAlerts" as const,
      label: "Application Alerts",
      description: "Saved as a local preference. Email delivery for application activity is not yet built — alerts currently only appear in-app.",
      icon: Bell,
    },
    {
      key: "weeklyDigest" as const,
      label: "Weekly Hermes Job Digest",
      description: "Receive weekly job matches powered by Hermes direct ATS scanner every Tuesday",
      icon: Zap,
    },
    {
      key: "marketingEmails" as const,
      label: "Marketing Emails",
      description: "Saved as a local preference. This product does not currently send marketing email.",
      icon: Smartphone,
    },
  ];

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationItems.map((item) => (
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
              checked={notifications[item.key]}
              onCheckedChange={(checked) => handleNotificationToggle(item.key, checked)}
              aria-label={`Toggle ${item.label}`}
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
  );
};
