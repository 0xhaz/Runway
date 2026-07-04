"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { PoolCard } from "@/components/dashboard/pool-card";
import { DeliberationPanel } from "@/components/dashboard/deliberation-panel";
import { bpsToPct, formatUnits, pct } from "@/lib/format";
import type { AssessResponse, Deliberation } from "@/lib/api";
import type { RevenueEvent } from "@runway/shared";
import { generateMockRevenue, type MerchantProfile } from "@/lib/mock";
import { POOL_LIST, type PoolId } from "@/lib/pools";

const PROFILES: { id: MerchantProfile; label: string; hint: string }[] = [
  { id: "healthy", label: "Healthy", hint: "steady, diversified" },
  { id: "volatile", label: "Volatile", hint: "spiky, concentrated" },
  { id: "thin", label: "Thin", hint: "short history" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function AssessView({
  profile,
  setProfile,
  result,
  loading,
  onAssess,
  onAccept,
  acceptingPool = null,
  blocked = null,
}: {
  profile: MerchantProfile;
  setProfile: (p: MerchantProfile) => void;
  result: AssessResponse | null;
  loading: boolean;
  onAssess: () => void;
  onAccept: (poolId: PoolId) => void;
  acceptingPool?: PoolId | null;
  blocked?: Deliberation | null;
}) {
  const events: RevenueEvent[] = useMemo(
    () => generateMockRevenue(profile, 100 * 86_400),
    [profile],
  );
  const f = result?.features;
  const offer = result?.offer;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: merchant + revenue */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Merchant revenue</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  On-chain x402 payments into the merchant&apos;s payTo account.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {result?.meta.source.startsWith("cspr.cloud") ? "live" : "synthesized demo"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {PROFILES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProfile(p.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      profile === p.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{p.label}</span>
                    <span className="ml-2 text-xs opacity-70">{p.hint}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <RevenueChart events={events} />
              </div>

              <Button onClick={onAssess} disabled={loading} size="lg" className="w-full">
                {loading ? "Underwriting…" : "Assess my revenue"}
              </Button>

              {f && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label="Trailing 30d" value={formatUnits(f.trailing30d)} />
                  <Stat label="Trailing 90d" value={formatUnits(f.trailing90d)} />
                  <Stat label="WoW trend" value={pct(f.weekOverWeekTrend)} />
                  <Stat label="Volatility" value={f.volatility.toFixed(2)} />
                  <Stat label="Payer conc." value={pct(f.payerConcentration)} />
                  <Stat label="Distinct payers" value={String(f.distinctPayers)} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: agent rationale */}
        <div className="lg:col-span-2">
          <Card className="border-primary/30 h-full">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Underwriting agent</CardTitle>
              {result && (
                <Badge variant={result.meta.underwriter === "hosted-model" ? "default" : "secondary"}>
                  {result.meta.underwriter === "hosted-model" ? "hosted model" : "fallback"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && !result && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              )}
              {!loading && !offer && (
                <p className="text-sm text-muted-foreground">
                  Run an assessment to see the agent&apos;s rationale, then compare pools.
                </p>
              )}
              {offer && (
                <>
                  <p className="text-sm leading-relaxed">{offer.rationale}</p>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Base advance" value={formatUnits(offer.advanceAmount)} />
                    <Stat label="Base sweep" value={bpsToPct(offer.sweepPct)} />
                    <Stat label="Base cap" value={`${offer.repaymentCap}×`} />
                    <Stat label="Confidence" value={pct(offer.confidence)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pool comparison + picker */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Choose a pool</h2>
            <span className="text-sm text-muted-foreground">
              — same agent offer, clamped to each pool&apos;s risk appetite.
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {POOL_LIST.map((p) => (
              <PoolCard
                key={p.id}
                pool={p}
                poolTerms={result.pools[p.id]}
                mode="accept"
                onAccept={() => onAccept(p.id)}
                accepting={acceptingPool === p.id}
              />
            ))}
          </div>
          {blocked && <DeliberationPanel deliberation={blocked} />}
        </div>
      )}
    </div>
  );
}
