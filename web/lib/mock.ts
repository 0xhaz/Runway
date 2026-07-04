/**
 * Demo revenue generator. Until the CSPR.cloud indexer is wired to a live key
 * (blocked on CSPR_CLOUD_API_KEY), the "Assess" flow underwrites a synthesized
 * on-chain revenue series so the full indexer→agent→policy pipeline runs end to end.
 *
 * Deterministic given (profile, asOf) so the demo is reproducible.
 */
import type { RevenueEvent } from "@runway/shared";

export type MerchantProfile = "healthy" | "volatile" | "thin";

const DAY = 86_400;

// Small seeded PRNG (mulberry32) — keeps the demo deterministic per profile.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ProfileCfg {
  days: number;
  perDay: number; // avg payments/day
  base: number; // avg payment in whole tokens
  jitter: number; // 0..1 volatility
  payers: number; // distinct payers
  whaleShare: number; // 0..1 share routed to one dominant payer
  drift: number; // per-day multiplicative trend
  seed: number;
}

const PROFILES: Record<MerchantProfile, ProfileCfg> = {
  healthy: { days: 90, perDay: 40, base: 0.05, jitter: 0.25, payers: 24, whaleShare: 0.15, drift: 1.004, seed: 1 },
  volatile: { days: 90, perDay: 22, base: 0.06, jitter: 0.85, payers: 6, whaleShare: 0.55, drift: 0.997, seed: 7 },
  thin: { days: 18, perDay: 9, base: 0.04, jitter: 0.5, payers: 3, whaleShare: 0.7, drift: 1.0, seed: 13 },
};

const DECIMALS = 9;
const ONE = 1_000_000_000; // 10^DECIMALS

export function generateMockRevenue(
  profile: MerchantProfile,
  asOf: number,
): RevenueEvent[] {
  const cfg = PROFILES[profile];
  const rand = rng(cfg.seed);
  const events: RevenueEvent[] = [];

  for (let d = cfg.days - 1; d >= 0; d--) {
    const dayStart = asOf - d * DAY;
    const trend = Math.pow(cfg.drift, cfg.days - d);
    const count = Math.max(0, Math.round(cfg.perDay * trend * (1 + (rand() - 0.5) * cfg.jitter)));
    for (let i = 0; i < count; i++) {
      const amt = cfg.base * (1 + (rand() - 0.5) * cfg.jitter) * trend;
      const base = Math.max(1, Math.round(amt * ONE));
      const isWhale = rand() < cfg.whaleShare;
      const payer = isWhale ? "whale-payer" : `payer-${Math.floor(rand() * cfg.payers)}`;
      events.push({
        timestamp: dayStart + Math.floor(rand() * DAY),
        amount: base.toString(),
        payer,
      });
    }
  }
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

export const DECIMALS_DEFAULT = DECIMALS;
