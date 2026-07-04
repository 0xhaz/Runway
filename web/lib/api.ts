import type { AgentOffer, ApprovedTerms, RevenueFeatures } from "@runway/shared";
import type { MerchantProfile } from "@/lib/mock";
import type { PoolId } from "@/lib/pools";

export interface PoolTerms {
  terms: ApprovedTerms;
  targetApy: number;
}

export interface AssessResponse {
  profile: MerchantProfile;
  features: RevenueFeatures;
  offer: AgentOffer;
  /** Per-pool clamped terms so the merchant can compare and pick. */
  pools: Record<PoolId, PoolTerms>;
  meta: {
    source: string;
    underwriter: "hosted-model" | "deterministic-fallback";
    events: number;
  };
}

export async function assess(profile: MerchantProfile): Promise<AssessResponse> {
  const res = await fetch("/api/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) throw new Error(`assess failed: ${res.status}`);
  return res.json();
}

export interface AgentVerdict {
  agent: "risk" | "treasury";
  position: "approve" | "veto";
  reason: string;
  evidence: Record<string, number | boolean | string>;
}

export interface Deliberation {
  verdicts: AgentVerdict[];
  approvals: number;
  vetoed: boolean;
  threshold: number;
  decision: "APPROVED" | "BLOCKED";
  reason: string;
}

export interface DaoAdvanceTrace {
  proposalId: number;
  proposalTx: string;
  approveTreasuryTx: string;
  approveRiskTx: string;
  executeTx: string;
  openAdvanceTx: string;
}

export interface AcceptResponse {
  simulated: boolean;
  poolId?: PoolId;
  txHash?: string;
  merchant?: string;
  reason?: string;
  /** Present for the DAO-governed Treasury pool. */
  deliberation?: Deliberation;
  /** True when the DAO blocked the advance (a veto or quorum failure). */
  blocked?: boolean;
  /** Present when the full live DAO funding flow ran (DAO_LIVE). */
  dao?: DaoAdvanceTrace;
}

/** Ask the server to open an advance on the chosen pool (DAO-governed for Treasury). */
export async function acceptAdvance(
  terms: ApprovedTerms,
  poolId: PoolId,
  features?: RevenueFeatures,
): Promise<AcceptResponse> {
  const res = await fetch("/api/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ terms, poolId, features }),
  });
  return res.json();
}
