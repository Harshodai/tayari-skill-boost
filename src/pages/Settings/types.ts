export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
}

export interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface NotificationPreferences {
  emailUpdates: boolean;
  applicationAlerts: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

export interface DisplayPreferences {
  compactView: boolean;
  autoSave: boolean;
}

export interface BillingTransaction {
  id?: string | number;
  description?: string;
  type?: "debit" | "credit" | string;
  reference_id?: string;
  created_at?: string;
  amount?: number;
  credits?: number;
}

export interface BillingData {
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  history: BillingTransaction[];
}
