import { apiFetch, apiFetchResponse } from "./client";
import { supabase } from "@/integrations/supabase/client";

/**
 * Credit-pack billing model.
 *
 * Source of truth is the Go billing service when it is reachable (self-hosted /
 * full-stack deploys). In hosted Lovable Cloud previews the Go gateway is not
 * deployed, so we fall back to the owner-scoped Cloud tables (`user_credits`,
 * `credit_ledger`, `credit_purchases`) which are written only by trusted
 * server-side fulfilment. Nothing here fabricates a balance: when neither
 * source answers, callers get `source: "unavailable"` and must say so in UI.
 */

export interface CreditBalance {
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  source: "gateway" | "cloud" | "unavailable";
}

export type LedgerType = "purchase" | "debit" | "refund" | "grant";

export interface CreditLedgerEntry {
  id: string;
  amount: number;
  type: LedgerType;
  description: string;
  reference_id: string | null;
  created_at: string;
}

export interface CreditPurchase {
  id: string;
  pack_id: string;
  pack_name: string;
  credits: number;
  amount_cents: number;
  currency: string;
  provider: string;
  provider_reference: string | null;
  status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  description?: string;
  popular?: boolean;
  best_value?: boolean;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getCreditBalance(): Promise<CreditBalance> {
  try {
    const res = await apiFetch<Record<string, unknown>>("/v1/billing/credits");
    return {
      balance: toNumber(res?.balance ?? res?.credits ?? res?.available_credits),
      lifetime_purchased: toNumber(res?.lifetime_purchased),
      lifetime_used: toNumber(res?.lifetime_used),
      source: "gateway",
    };
  } catch {
    // Gateway absent (hosted preview) or degraded — read the Cloud mirror.
  }

  const { data, error } = await supabase
    .from("user_credits")
    .select("balance, lifetime_purchased, lifetime_used")
    .maybeSingle();

  if (error) {
    return { balance: 0, lifetime_purchased: 0, lifetime_used: 0, source: "unavailable" };
  }

  return {
    balance: toNumber(data?.balance),
    lifetime_purchased: toNumber(data?.lifetime_purchased),
    lifetime_used: toNumber(data?.lifetime_used),
    source: "cloud",
  };
}

export async function listCreditLedger(limit = 50): Promise<CreditLedgerEntry[]> {
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, amount, type, description, reference_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as CreditLedgerEntry[];
}

export async function listCreditPurchases(limit = 25): Promise<CreditPurchase[]> {
  const { data, error } = await supabase
    .from("credit_purchases")
    .select(
      "id, pack_id, pack_name, credits, amount_cents, currency, provider, provider_reference, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as CreditPurchase[];
}

export interface CheckoutStartResult {
  url?: string;
  /** Billing is not configured/reachable in this environment. */
  unavailable?: boolean;
  message?: string;
}

export async function startCreditCheckout(packId: string): Promise<CheckoutStartResult> {
  try {
    const response = await apiFetchResponse("/v1/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({
        plan: packId,
        pack_id: packId,
        return_url: `${window.location.origin}/credits`,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (data?.url) return { url: data.url };
    return {
      unavailable: true,
      message: data?.error || "The payment provider did not return a checkout link. No purchase was made.",
    };
  } catch (err) {
    return {
      unavailable: true,
      message:
        err instanceof Error && err.message
          ? err.message
          : "Card checkout isn't available in this environment yet. No purchase was made.",
    };
  }
}
