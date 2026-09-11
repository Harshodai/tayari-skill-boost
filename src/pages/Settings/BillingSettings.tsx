import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/api";
import type { BillingData, BillingTransaction } from "./types";

export const BillingSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [lifetimePurchased, setLifetimePurchased] = useState<number>(0);
  const [lifetimeUsed, setLifetimeUsed] = useState<number>(0);
  const [unlimited, setUnlimited] = useState(false);
  const [history, setHistory] = useState<BillingTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<BillingData>("/v1/billing/credits")
      .then((res) => {
        setBalance(typeof res?.balance === "number" ? res.balance : 0);
        setLifetimePurchased(
          typeof res?.lifetime_purchased === "number" ? res.lifetime_purchased : 0
        );
        setLifetimeUsed(typeof res?.lifetime_used === "number" ? res.lifetime_used : 0);
        setUnlimited(res?.unlimited === true);
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
          <CardDescription>
            1 credit is debited only when a verified ATS submission receipt is generated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {unlimited && (
            <p className="text-xs text-muted-foreground">
              Billing is disabled for this deployment — submissions are unmetered.
            </p>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-3xl font-extrabold tabular-nums text-primary">{unlimited ? "Unlimited" : balance}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">Available</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/50">
              <p className="text-3xl font-extrabold tabular-nums">{unlimited ? "—" : lifetimePurchased}</p>
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
              Credits never expire. Failed or unverifiable applications cost{" "}
              <strong>$0.00 / 0 credits</strong>.
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
            <p className="text-sm text-muted-foreground py-4 text-center">
              No transactions yet. Purchase a credit pack to get started.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {history.map((tx: BillingTransaction, i: number) => (
                <div key={tx.id ?? i} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description ||
                        (tx.type === "debit" ? "Verified Submission" : "Credit Pack Purchase")}
                    </p>
                    {tx.reference_id && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                        ref: {tx.reference_id}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.created_at
                        ? new Date(tx.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        tx.type === "debit" ? "text-destructive" : "text-success"
                      }`}
                    >
                      {tx.type === "debit" ? "-" : "+"}
                      {Math.abs(tx.amount ?? tx.credits ?? 0)} cr
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
};

export const BillingTab = BillingSettings;
