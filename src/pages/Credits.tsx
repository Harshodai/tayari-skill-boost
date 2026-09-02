import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/ui/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Seo } from "@/components/seo/Seo";
import { Coins, Receipt, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";
import {
  getCreditBalance,
  listCreditLedger,
  listCreditPurchases,
  type CreditLedgerEntry,
} from "@/api/credits";

const LEDGER_LABEL: Record<CreditLedgerEntry["type"], string> = {
  purchase: "Pack purchased",
  debit: "Verified submission",
  refund: "Refunded",
  grant: "Granted",
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export default function Credits() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const balanceQuery = useQuery({
    queryKey: ["credit-balance", user?.id],
    enabled: !!user,
    queryFn: getCreditBalance,
  });
  const ledgerQuery = useQuery({
    queryKey: ["credit-ledger", user?.id],
    enabled: !!user,
    queryFn: () => listCreditLedger(50),
  });
  const purchasesQuery = useQuery({
    queryKey: ["credit-purchases", user?.id],
    enabled: !!user,
    queryFn: () => listCreditPurchases(25),
  });

  const balance = balanceQuery.data;
  const unavailable = balance?.source === "unavailable";

  return (
    <AppShell>
      <Seo
        title="Credits — Job Tayari"
        description="See your credit balance, the packs you bought, and every credit charged for a verified submission."
        path="/credits"
        noindex
      />
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Credits</h1>
          <p className="text-muted-foreground">
            One credit is charged only when a submission is confirmed by the ATS. Failed or unverifiable
            attempts are refunded automatically.
          </p>
        </header>

        {unavailable && (
          <Card role="alert" className="border-destructive/40">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
              <span>
                We couldn't read your credit balance right now, so the numbers below aren't confirmed. Try
                again in a moment.
              </span>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Coins className="h-4 w-4" aria-hidden /> Available balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceQuery.isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">{unavailable ? "—" : balance?.balance ?? 0}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">credits ready to use</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" aria-hidden /> Lifetime purchased
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceQuery.isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">
                  {unavailable ? "—" : balance?.lifetime_purchased ?? 0}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">across all packs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden /> Verified submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceQuery.isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">{unavailable ? "—" : balance?.lifetime_used ?? 0}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">credits spent on confirmed receipts</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/checkout")}>Buy credits</Button>
          <Button variant="outline" asChild>
            <Link to="/outcomes">View submission receipts</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Packs bought</CardTitle>
            <CardDescription>Every credit pack purchase recorded for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={purchasesQuery.isLoading}
              error={purchasesQuery.error}
              isEmpty={(purchasesQuery.data ?? []).length === 0}
              onRetry={() => purchasesQuery.refetch()}
              emptyTitle="No packs bought yet"
              emptyDescription="Buy a credit pack to start submitting applications with verified receipts."
              emptyAction={{ label: "See packs", onClick: () => navigate("/checkout") }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pack</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(purchasesQuery.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.pack_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.credits}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.amount_cents, p.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-4 w-4" aria-hidden /> Credit history
            </CardTitle>
            <CardDescription>Charges, refunds and grants, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={ledgerQuery.isLoading}
              error={ledgerQuery.error}
              isEmpty={(ledgerQuery.data ?? []).length === 0}
              onRetry={() => ledgerQuery.refetch()}
              emptyTitle="No credit activity yet"
              emptyDescription="Credits appear here the moment a pack is added or a submission is confirmed."
            >
              <ul className="divide-y">
                {(ledgerQuery.data ?? []).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {LEDGER_LABEL[entry.type]} · {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        entry.amount > 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </DataState>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
