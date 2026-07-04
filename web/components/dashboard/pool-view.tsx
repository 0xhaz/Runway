"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoolCard } from "@/components/dashboard/pool-card";
import { formatUnits, pct } from "@/lib/format";
import { POOL_LIST, targetApy } from "@/lib/pools";

/** Illustrative per-pool LP figures (mocked balances/utilization for the demo). */
const LP: Record<string, { balance: string; utilization: number }> = {
  prime: { balance: "500000000000000", utilization: 0.36 },
  treasury: { balance: "820000000000000", utilization: 0.54 },
};

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function PoolView() {
  const totalBalance = POOL_LIST.reduce((a, p) => a + BigInt(LP[p.id].balance), 0n);
  const blendedApy =
    POOL_LIST.reduce((a, p) => a + targetApy(p), 0) / POOL_LIST.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline">LP view</Badge>
        <span className="text-sm text-muted-foreground">
          Pick a pool by risk band and target APY. Treasury Yield is funded &amp; governed by
          the multi-agent DAO.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total capital" value={formatUnits(totalBalance.toString())} sub="across pools" />
        <Metric label="Blended target APY" value={pct(blendedApy, 1)} />
        <Metric label="Pools" value={String(POOL_LIST.length)} sub="Prime · Treasury Yield" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {POOL_LIST.map((p) => (
          <PoolCard
            key={p.id}
            pool={p}
            mode="lp"
            balance={LP[p.id].balance}
            utilization={LP[p.id].utilization}
          />
        ))}
      </div>
    </div>
  );
}
