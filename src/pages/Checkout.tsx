import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Coins, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { startCreditCheckout } from "@/api/credits";

interface Pack {
  id: string;
  name: string;
  credits: number;
  price: number;
  blurb: string;
  badge?: string;
}

const DEFAULT_PACKS: Pack[] = [
  { id: "starter", name: "Starter Pack", credits: 10, price: 19, blurb: "Try the workflow on a handful of roles." },
  { id: "pro", name: "Pro Pack", credits: 35, price: 49, blurb: "For an active search.", badge: "Most picked" },
  { id: "power", name: "Power Pack", credits: 100, price: 99, blurb: "Full-time search volume.", badge: "Best value" },
];

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requested = searchParams.get("pack");
  const [packId, setPackId] = useState(
    DEFAULT_PACKS.some((p) => p.id === requested) ? (requested as string) : "pro",
  );

  const pack = useMemo(
    () => DEFAULT_PACKS.find((p) => p.id === packId) ?? DEFAULT_PACKS[1],
    [packId],
  );

  const unitPrice = (pack.price / pack.credits).toFixed(2);

  const handlePay = async () => {
    setError(null);
    if (!user) {
      navigate(`/auth?mode=signup&next=${encodeURIComponent(`/checkout?pack=${pack.id}`)}`);
      return;
    }
    setBusy(true);
    try {
      const result = await startCreditCheckout(pack.id);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      const message = result.message || "Checkout is unavailable right now. No purchase was made.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Seo
        title="Checkout — Job Tayari submission credits"
        description="Buy a pack of submission credits. One credit is used only when a verified submission receipt is captured."
        path="/checkout"
      />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Buy submission credits</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Credits never expire. One credit is debited only when a submission produces a verified
          ATS confirmation receipt — failed or unverifiable attempts cost nothing.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choose a pack</CardTitle>
              <CardDescription>You can top up again at any time.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={packId} onValueChange={setPackId} className="space-y-3">
                {DEFAULT_PACKS.map((p) => (
                  <Label
                    key={p.id}
                    htmlFor={`pack-${p.id}`}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                      p.id === packId ? "border-primary bg-primary/5" : "hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem id={`pack-${p.id}`} value={p.id} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        {p.badge ? <Badge variant="outline">{p.badge}</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.blurb}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">${p.price}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {p.credits} credits
                      </div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="h-max">
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pack</span>
                <span className="font-medium">{pack.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-medium tabular-nums">{pack.credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per verified submission</span>
                <span className="font-medium tabular-nums">${unitPrice}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-semibold tabular-nums">${pack.price}</span>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button onClick={handlePay} disabled={busy} className="w-full">
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Coins className="mr-2 h-4 w-4" />
                )}
                {user ? `Pay $${pack.price}` : "Create account to continue"}
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                Payment is handled by our payment provider. We never store card details.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
