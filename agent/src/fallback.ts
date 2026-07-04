/**
 * Deterministic underwriting fallback (architecture.md §5.2:
 * "the formula is the fallback, not the product"). Guarantees the demo always
 * yields a sane offer even with no LLM. The policy layer still clamps whatever
 * this returns, so it can never breach hard limits.
 */
import type { AgentOffer, RevenueFeatures } from "@runway/shared";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Composite risk in [0,1]: higher = riskier. */
export function riskScore(f: RevenueFeatures): number {
  const volRisk = clamp(f.volatility, 0, 1); // CV already ~0..1+
  const concRisk = clamp(f.payerConcentration, 0, 1); // single-payer dependence
  const trendRisk = clamp(-f.weekOverWeekTrend, 0, 1); // shrinking revenue is risky
  const thinRisk = clamp((45 - f.observedDays) / 45, 0, 1); // short history is risky
  return clamp(0.35 * volRisk + 0.3 * concRisk + 0.2 * trendRisk + 0.15 * thinRisk, 0, 1);
}

export function underwriteFallback(features: RevenueFeatures): AgentOffer {
  const risk = riskScore(features);

  // Advance 15–50% of trailing-30d revenue, shrinking as risk rises.
  const factor = clamp(0.5 - 0.35 * risk, 0.15, 0.5);
  const advance =
    (BigInt(features.trailing30d) * BigInt(Math.round(factor * 10000))) / 10000n;

  // Riskier stream → sweep more per payment and demand a higher repayment cap.
  const sweepPct = Math.round(clamp(1000 + 2000 * risk, 500, 3000));
  const repaymentCap = Number(clamp(1.08 + 0.2 * risk, 1.05, 1.3).toFixed(3));
  const confidence = Number(clamp(1 - risk, 0.15, 0.95).toFixed(2));

  const rationale =
    `Deterministic fallback underwriting. Trailing-30d revenue ` +
    `${features.trailing30d} base units over ${features.observedDays} observed days ` +
    `from ${features.distinctPayers} distinct payer(s). ` +
    `Risk ${(risk * 100).toFixed(0)}% (volatility ${(features.volatility).toFixed(2)}, ` +
    `payer concentration ${(features.payerConcentration * 100).toFixed(0)}%, ` +
    `WoW trend ${(features.weekOverWeekTrend * 100).toFixed(0)}%). ` +
    `Advancing ${(factor * 100).toFixed(0)}% of trailing revenue with a ` +
    `${(sweepPct / 100).toFixed(0)}% sweep and ${repaymentCap}× cap.`;

  return {
    advanceAmount: advance.toString(),
    sweepPct,
    repaymentCap,
    confidence,
    rationale,
  };
}
