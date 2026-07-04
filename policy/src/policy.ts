/**
 * Policy / Guardrail layer — pure deterministic clamping (architecture.md §5.3).
 *
 * The safety valve between a probabilistic agent and real money: CLAMPS the
 * agent's offer to a pool's hard limits and records why. No chain deps here, so
 * it stays trivially unit-testable; the signing/on-chain side lives in ./chain.
 */
import type { AgentOffer, ApprovedTerms, RevenueFeatures } from "@runway/shared";
import { bigMin, clampFloat, clampInt, mulBps, toBig } from "./units.ts";

/** Shape of a pool's hard guardrails. */
export interface PolicyLimits {
  /** max advance as a bps fraction of trailing-30d revenue (5000 = 50%). */
  maxAdvanceBpsOfTrailing30d: number;
  minSweepPct: number;
  maxSweepPct: number;
  minRepaymentCap: number;
  maxRepaymentCap: number;
  absoluteCapBaseUnits: string;
}

/** Default (conservative "Prime" pool) guardrails. */
export const LIMITS: PolicyLimits = {
  maxAdvanceBpsOfTrailing30d: 5000,
  minSweepPct: 500, // 5%
  maxSweepPct: 3000, // 30%
  minRepaymentCap: 1.05,
  maxRepaymentCap: 1.3,
  absoluteCapBaseUnits: "1000000000000", // per-merchant hard ceiling
};

/**
 * Deterministically clamp the agent's offer to a pool's limits. Never throws on
 * an out-of-range offer — it clamps and records why, so the demo always yields a
 * signable, safe set of terms. `clamped` + `clampNotes` make the guardrail's
 * action auditable in the UI. Pass a pool's `limits` to underwrite with that
 * pool's risk appetite (different limits → different terms → different APY).
 */
export function applyPolicy(
  offer: AgentOffer,
  features: RevenueFeatures,
  limits: PolicyLimits = LIMITS,
): ApprovedTerms {
  const notes: string[] = [];

  // ── advance amount: min(offer, maxMultiple × trailing30d, absoluteCap) ──
  const requested = toBig(offer.advanceAmount);
  const revenueCap = mulBps(toBig(features.trailing30d), limits.maxAdvanceBpsOfTrailing30d);
  const absoluteCap = toBig(limits.absoluteCapBaseUnits);
  const advance = bigMin(requested, revenueCap, absoluteCap);
  if (advance < requested) {
    if (advance === revenueCap) {
      notes.push(
        `advance capped to ${limits.maxAdvanceBpsOfTrailing30d / 100}% of trailing-30d revenue`,
      );
    }
    if (advance === absoluteCap) notes.push("advance capped to absolute per-merchant ceiling");
  }

  // ── sweep percentage: clamp to [min, max] bps ──
  const sweepPct = clampInt(offer.sweepPct, limits.minSweepPct, limits.maxSweepPct);
  if (sweepPct !== offer.sweepPct) {
    notes.push(`sweepPct clamped ${offer.sweepPct} → ${sweepPct} bps`);
  }

  // ── repayment cap: clamp to [min, max] ──
  const repaymentCap = clampFloat(offer.repaymentCap, limits.minRepaymentCap, limits.maxRepaymentCap);
  if (repaymentCap !== offer.repaymentCap) {
    notes.push(`repaymentCap clamped ${offer.repaymentCap} → ${repaymentCap}`);
  }

  // ── owed = advance × repaymentCap (bps-scaled bigint) ──
  const owed = mulBps(advance, Math.round(repaymentCap * 10000));

  return {
    merchant: features.merchant,
    advanceAmount: advance.toString(),
    sweepPct,
    repaymentCap,
    owed: owed.toString(),
    clamped: notes.length > 0,
    clampNotes: notes,
  };
}
