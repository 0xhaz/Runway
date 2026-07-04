"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DeliberationPanel } from "@/components/dashboard/deliberation-panel";
import { formatUnits, bpsToPct, pct, shortHash } from "@/lib/format";
import { repaidFraction, type SimAdvance } from "@/lib/sim";
import type { Deliberation } from "@/lib/api";

function TxRow({ label, hash, kind }: { label: string; hash: string; kind: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {kind}
        </Badge>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <a
        href={`https://testnet.cspr.live/deploy/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-primary hover:underline"
      >
        {shortHash(hash, 8, 6)}
      </a>
    </div>
  );
}

export function AdvanceView({
  advance,
  onSimulatePayment,
  onReset,
  deliberation = null,
}: {
  advance: SimAdvance | null;
  onSimulatePayment: () => void;
  onReset: () => void;
  deliberation?: Deliberation | null;
}) {
  if (!advance) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          No active advance. Assess revenue and accept an offer to open one.
        </CardContent>
      </Card>
    );
  }

  const repaid = repaidFraction(advance);
  const isRepaid = advance.status === "Repaid";

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-6">
        <Card className={isRepaid ? "border-emerald-500/40" : "border-primary/30"}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Advance lifecycle</CardTitle>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{advance.poolName}</span>
                <span>·</span>
                <span>{advance.assetSymbol}</span>
                {advance.governed && <Badge variant="outline">DAO-governed</Badge>}
              </div>
            </div>
            <Badge variant={isRepaid ? "default" : "secondary"}>
              {isRepaid ? "Repaid" : "Active"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Disbursed</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {formatUnits(advance.principal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Owed</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {formatUnits(advance.owed)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Sweep</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {bpsToPct(advance.sweepPct)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cap</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {advance.repaymentCap}×
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Repayment progress</span>
                <span className="font-mono tabular-nums">{pct(repaid, 1)}</span>
              </div>
              <Progress value={repaid * 100} />
            </div>

            <div className="flex gap-3">
              <Button onClick={onSimulatePayment} disabled={isRepaid} className="flex-1">
                {isRepaid ? "Advance closed" : "Simulate incoming x402 payment"}
              </Button>
              <Button onClick={onReset} variant="outline">
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {deliberation && <DeliberationPanel deliberation={deliberation} />}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">On-chain activity</CardTitle>
          </CardHeader>
          <CardContent>
            {advance.dao && (
              <>
                <TxRow kind="propose" label="create_proposal (execution)" hash={advance.dao.proposalTx} />
                <TxRow kind="approve" label="approve (treasury agent)" hash={advance.dao.approveTreasuryTx} />
                <TxRow kind="approve" label="approve (risk agent)" hash={advance.dao.approveRiskTx} />
                <TxRow kind="execute" label="execute · release TDAO" hash={advance.dao.executeTx} />
                <Separator className="my-1" />
              </>
            )}
            <TxRow kind="open" label="open_advance · disburse" hash={advance.openTxHash} />
            <Separator className="my-1" />
            {advance.payments.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No sweeps yet. Each incoming payment routes {bpsToPct(advance.sweepPct)} to{" "}
                <code className="text-xs">repay()</code>.
              </p>
            ) : (
              advance.payments.map((p) => (
                <TxRow
                  key={p.txHash}
                  kind="repay"
                  label={`sweep ${formatUnits(p.swept)} of ${formatUnits(p.paymentAmount)}`}
                  hash={p.txHash}
                />
              ))
            )}
            {isRepaid && (
              <>
                <Separator className="my-1" />
                <TxRow kind="close" label="advance closed" hash={advance.openTxHash} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
