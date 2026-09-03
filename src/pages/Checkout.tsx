import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import { Seo } from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineError } from "@/components/ui/data-state";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PACKS, type CreditPackItem } from "@/pages/Pricing";
import { getCreditBalance, startCreditCheckout } from "@/api/credits";
import { Check, Coins, Loader2, ShieldCheck } from "lucide-react";

/**
 * Checkout for the credit-pack model. One credit = one ATS-confirmed
 * submission. Nothing here simulates a purchase: if the payment provider is
 * not configured for this deployment we say so plainly.
 */
export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPack = params.get("pack");

  const [selected, setSelected] = useState<string>(
    DEFAULT_PACKS.find((p) => p.id === requestedPack)?.id ?? DEFAULT_PACKS.find((p) => p.popular)?.id ?? DEFAULT_PACKS[0].id,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setBalance(null);
      return;
    }
    getCreditBalance().then((b) => {
      if (mounted) setBalance(b.source === "unavailable" ? null : b.balance);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  const pack: CreditPackItem = useMemo(
    () => DEFAULT_PACKS.find((p) => p.id === selected) ?? DEFAULT_PACKS[0],
    [selected],
  );

  const handlePay = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/checkout?pack=${pack.id}`)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await startCreditCheckout(pack.id);
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    setSubmitting(false);
    setError(result.message ?? "Checkout is unavailable right now. No purchase was made.");
    toast.error("No purchase was made.");
  };

  return (
    <Layout>
      <Seo
        title="Checkout — Buy Job Tayari credits"
        description="Buy a credit pack. One credit is charged only when a submission is confirmed by the ATS; failed or unverifiable applications cost nothing."
        path="/checkout"
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground">
            Pick a pack. Credits never expire, and one credit is only charged for a submission with an ATS
            confirmation receipt.
          </p>
          {balance !== null && (
            <p className="text-sm text-muted-foreground">
              Current balance: <span className="font-semibold text-foreground tabular-nums">{balance}</span> credits ·{" "}
              <Link to="/credits" className="underline underline-offset-4">
                view dashboard
              </Link>
            </p>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div
            role="radiogroup"
            aria-label="Credit packs"
            className="grid gap-4 sm:grid-cols-3"
          >
            {DEFAULT_PACKS.map((p) => {
              const active = p.id === selected;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(p.id)}
                  className={`rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-display font-semibold">{p.name}</span>
                    {p.popular && <Badge>Popular</Badge>}
                    {p.bestValue && <Badge variant="secondary">Best value</Badge>}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{p.priceFormatted}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.credits} credits · {p.unitPrice}
                  </p>
                </button>
              );
            })}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Coins className="h-4 w-4" aria-hidden /> Order summary
              </CardTitle>
              <CardDescription>{pack.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-medium tabular-nums">{pack.credits}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Per verified submission</span>
                <span className="font-medium">{pack.unitPrice}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{pack.priceFormatted}</span>
              </div>

              {error && <InlineError title="Checkout unavailable" message={error} onRetry={handlePay} />}

              <Button className="w-full" onClick={handlePay} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Starting secure checkout…
                  </>
                ) : user ? (
                  `Pay ${pack.priceFormatted}`
                ) : (
                  "Sign up to continue"
                )}
              </Button>

              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                  1 credit charged only on an ATS-confirmed receipt
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                  Failed or unverifiable submissions are refunded automatically
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                  Unused credits refundable within 7 days
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
