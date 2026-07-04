"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssessView } from "@/components/dashboard/assess-view";
import { AdvanceView } from "@/components/dashboard/advance-view";
import { PoolView } from "@/components/dashboard/pool-view";
import { assess, acceptAdvance, type AssessResponse, type Deliberation } from "@/lib/api";
import { applyPayment, createAdvance, type SimAdvance } from "@/lib/sim";
import { shortHash } from "@/lib/format";
import type { MerchantProfile } from "@/lib/mock";
import { POOLS, type PoolId } from "@/lib/pools";

export default function Home() {
  const [tab, setTab] = useState("assess");
  const [profile, setProfile] = useState<MerchantProfile>("healthy");
  const [result, setResult] = useState<AssessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [advance, setAdvance] = useState<SimAdvance | null>(null);

  async function handleAssess() {
    setLoading(true);
    try {
      const r = await assess(profile);
      setResult(r);
      toast.success("Underwriting complete", {
        description: `${r.meta.underwriter === "hosted-model" ? "Hosted model" : "Deterministic fallback"} · ${r.meta.events} payments analyzed`,
      });
    } catch (e) {
      toast.error("Assessment failed", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const [acceptingPool, setAcceptingPool] = useState<PoolId | null>(null);
  const [blocked, setBlocked] = useState<Deliberation | null>(null);

  async function handleAccept(poolId: PoolId) {
    if (!result) return;
    const pool = POOLS[poolId];
    const terms = result.pools[poolId].terms;
    setAcceptingPool(poolId);
    setBlocked(null);
    try {
      const res = await acceptAdvance(terms, poolId, result.features);

      // DAO vetoed / quorum not met — no advance opens.
      if (res.blocked) {
        setBlocked(res.deliberation ?? null);
        toast.error("TreasuryDAO blocked the advance", {
          description: res.deliberation?.reason ?? "vetoed by an agent",
        });
        return;
      }

      setAdvance(
        createAdvance(terms, res.txHash, {
          poolName: pool.name,
          assetSymbol: pool.assetSymbol,
          governed: pool.governed,
          deliberation: res.deliberation,
          dao: res.dao,
        }),
      );
      setTab("advance");
      if (res.simulated) {
        toast.info(`Advance opened (simulated) · ${pool.name}`, {
          description: res.reason ?? "chain not configured — using local simulation",
        });
      } else {
        toast.success(`open_advance on Testnet · ${pool.name}`, {
          description: `tx ${shortHash(res.txHash ?? "", 8, 6)} · signed by the policy signer`,
        });
      }
    } catch (e) {
      toast.error("Accept failed", { description: String(e) });
    } finally {
      setAcceptingPool(null);
    }
  }

  function handleSimulatePayment() {
    setAdvance((a) => {
      if (!a) return a;
      // An incoming x402 payment ~2% of the principal.
      const payment = (BigInt(a.principal) * 2n) / 100n;
      const next = applyPayment(a, payment);
      if (next.status === "Repaid") {
        toast.success("Advance fully repaid", { description: "owed → 0 · status Repaid" });
      }
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl font-semibold tracking-tight hover:opacity-80">
              Runway
            </Link>
            <Badge variant="outline">Casper Testnet</Badge>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Agentic revenue-based financing for x402 API businesses. An agent underwrites
            your on-chain revenue; the contract disburses and auto-sweeps repayment. The
            revenue is the collateral.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            toast.info("Wallet connection pending", {
              description: "CSPR.click integration is the Phase 1 wallet spike.",
            })
          }
        >
          Connect wallet
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="assess">Assess</TabsTrigger>
          <TabsTrigger value="advance">
            Advance
            {advance && (
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </TabsTrigger>
          <TabsTrigger value="pool">Pool</TabsTrigger>
        </TabsList>

        <TabsContent value="assess" className="mt-6">
          <AssessView
            profile={profile}
            setProfile={setProfile}
            result={result}
            loading={loading}
            onAssess={handleAssess}
            onAccept={handleAccept}
            acceptingPool={acceptingPool}
            blocked={blocked}
          />
        </TabsContent>

        <TabsContent value="advance" className="mt-6">
          <AdvanceView
            advance={advance}
            onSimulatePayment={handleSimulatePayment}
            onReset={() => setAdvance(null)}
            deliberation={advance?.deliberation ?? null}
          />
        </TabsContent>

        <TabsContent value="pool" className="mt-6">
          <PoolView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
