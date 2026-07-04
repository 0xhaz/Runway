/**
 * Pool registry. Runway runs multiple capital pools, each with its own asset,
 * risk appetite (policy limits → different terms → different APY), and funding
 * model. "Prime" is Runway's own self-funded pool; "Treasury Yield" is funded and
 * governed by the multi-agent TreasuryDAO.
 */
import type { PolicyLimits } from "@runway/policy";

export type PoolId = "prime" | "treasury";

export interface PoolConfig {
  id: PoolId;
  name: string;
  tagline: string;
  assetSymbol: string;
  assetPackageHash: string; // CEP-18 package (env-overridable)
  contractHashEnv: string; // env var holding this pool's RunwayAdvance hash
  riskBand: "Conservative" | "High-yield";
  governed: boolean; // Treasury pool is DAO-governed
  limits: PolicyLimits;
  /** For the illustrative APY model. */
  annualTurnover: number; // effective times/yr capital recycles net of idle time
  expectedDefaultRate: number; // 0..1
}

export const POOLS: Record<PoolId, PoolConfig> = {
  prime: {
    id: "prime",
    name: "Runway Prime",
    tagline: "Runway's own pool · steady, self-funded",
    assetSymbol: "RUN",
    assetPackageHash: process.env.ASSET_PACKAGE_HASH ?? "",
    contractHashEnv: "RUNWAY_ADVANCE_CONTRACT_HASH",
    riskBand: "Conservative",
    governed: false,
    limits: {
      maxAdvanceBpsOfTrailing30d: 4000, // ≤40% of trailing revenue
      minSweepPct: 500,
      maxSweepPct: 2000,
      minRepaymentCap: 1.05,
      maxRepaymentCap: 1.15,
      absoluteCapBaseUnits: "1000000000000",
    },
    annualTurnover: 1.0,
    expectedDefaultRate: 0.02,
  },
  treasury: {
    id: "treasury",
    name: "Treasury Yield",
    tagline: "DAO-governed · higher-yield, agent-underwritten capital",
    assetSymbol: "TDAO",
    assetPackageHash: process.env.TREASURY_TOKEN_PACKAGE_HASH ?? "",
    contractHashEnv: "TREASURY_POOL_CONTRACT_HASH",
    riskBand: "High-yield",
    governed: true,
    limits: {
      maxAdvanceBpsOfTrailing30d: 7000, // ≤70% — more aggressive
      minSweepPct: 1500,
      maxSweepPct: 3000,
      minRepaymentCap: 1.15,
      maxRepaymentCap: 1.35,
      absoluteCapBaseUnits: "2000000000000",
    },
    annualTurnover: 1.0,
    expectedDefaultRate: 0.08,
  },
};

export const POOL_LIST: PoolConfig[] = [POOLS.prime, POOLS.treasury];

/**
 * Illustrative pool-level target APY (a stable property of the pool, not one
 * merchant's offer):
 *   APY ≈ (midpointCap − 1) × annualTurnover × (1 − expectedDefaultRate)
 */
export function targetApy(pool: PoolConfig): number {
  const midCap = (pool.limits.minRepaymentCap + pool.limits.maxRepaymentCap) / 2;
  return (midCap - 1) * pool.annualTurnover * (1 - pool.expectedDefaultRate);
}
