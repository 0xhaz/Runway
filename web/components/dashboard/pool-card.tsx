"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { bpsToPct, formatUnits, pct } from "@/lib/format";
import { targetApy, type PoolConfig } from "@/lib/pools";
import type { PoolTerms } from "@/lib/api";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

export function PoolCard({
  pool,
  poolTerms,
  mode,
  onAccept,
  accepting = false,
  utilization,
  balance,
}: {
  pool: PoolConfig;
  poolTerms?: PoolTerms;
  mode: "accept" | "lp";
  onAccept?: () => void;
  accepting?: boolean;
  utilization?: number;
  balance?: string;
}) {
  const apy = poolTerms ? poolTerms.targetApy : targetApy(pool);
  const t = poolTerms?.terms;

  return (
    <Card className={pool.governed ? "border-primary/40" : ""}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{pool.name}</div>
          <div className="flex gap-1.5">
            {pool.governed && <Badge>DAO-governed</Badge>}
            <Badge variant="outline">{pool.riskBand}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{pool.tagline}</p>
        <div className="flex items-baseline gap-2 pt-1">
          <span className="font-mono text-3xl font-semibold tabular-nums">{pct(apy, 1)}</span>
          <span className="text-xs text-muted-foreground">target APY · {pool.assetSymbol}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {t ? (
          <>
            <Separator />
            <Row label="Advance" value={`${formatUnits(t.advanceAmount)} ${pool.assetSymbol}`} />
            <Row label="Total owed" value={`${formatUnits(t.owed)} ${pool.assetSymbol}`} />
            <Row label="Sweep" value={bpsToPct(t.sweepPct)} />
            <Row label="Repayment cap" value={`${t.repaymentCap}×`} />
            {t.clampNotes.length > 0 && (
              <ul className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {t.clampNotes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            )}
          </>
        ) : mode === "lp" ? (
          <>
            <Separator />
            {balance !== undefined && (
              <Row label="Pool balance" value={`${formatUnits(balance)} ${pool.assetSymbol}`} />
            )}
            {utilization !== undefined && <Row label="Utilization" value={pct(utilization)} />}
            <Row label="Sweep range" value={`${bpsToPct(pool.limits.minSweepPct)}–${bpsToPct(pool.limits.maxSweepPct)}`} />
            <Row label="Cap range" value={`${pool.limits.minRepaymentCap}–${pool.limits.maxRepaymentCap}×`} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Assess revenue to see this pool&apos;s offer.</p>
        )}

        {mode === "accept" && t && onAccept && (
          <Button onClick={onAccept} disabled={accepting} className="w-full">
            {accepting
              ? "Submitting…"
              : pool.governed
                ? "Request from DAO treasury →"
                : `Accept from ${pool.name} →`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
