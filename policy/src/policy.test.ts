import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AgentOffer, RevenueFeatures } from "@runway/shared";
import { applyPolicy, LIMITS } from "./policy.ts";

const features: RevenueFeatures = {
  merchant: "acct-merchant",
  asset: "cep18-pkg",
  decimals: 9,
  trailing30d: "1000000000", // 1e9 base units
  trailing60d: "1900000000",
  trailing90d: "2700000000",
  weekOverWeekTrend: 0.05,
  volatility: 0.2,
  payerConcentration: 0.3,
  distinctPayers: 12,
  observedDays: 75,
};

const baseOffer: AgentOffer = {
  advanceAmount: "400000000", // 4e8 — within 50% of trailing30d (5e8)
  sweepPct: 1500,
  repaymentCap: 1.15,
  confidence: 0.8,
  rationale: "ok",
};

test("in-range offer passes unclamped and computes owed", () => {
  const terms = applyPolicy(baseOffer, features);
  assert.equal(terms.clamped, false);
  assert.equal(terms.advanceAmount, "400000000");
  assert.equal(terms.sweepPct, 1500);
  assert.equal(terms.repaymentCap, 1.15);
  assert.equal(terms.owed, "460000000"); // 4e8 * 1.15
});

test("over-advance is clamped to the trailing-revenue cap", () => {
  const terms = applyPolicy({ ...baseOffer, advanceAmount: "900000000" }, features);
  assert.equal(terms.clamped, true);
  // 50% of trailing30d = 5e8
  assert.equal(terms.advanceAmount, "500000000");
  assert.ok(terms.clampNotes.some((n) => n.includes("trailing-30d")));
});

test("sweepPct and cap are clamped to hard limits", () => {
  const terms = applyPolicy(
    { ...baseOffer, sweepPct: 100, repaymentCap: 2.0 },
    features,
  );
  assert.equal(terms.sweepPct, LIMITS.minSweepPct);
  assert.equal(terms.repaymentCap, LIMITS.maxRepaymentCap);
  assert.equal(terms.clamped, true);
});

test("absolute ceiling caps very large advances", () => {
  const rich = { ...features, trailing30d: "100000000000000" };
  const terms = applyPolicy({ ...baseOffer, advanceAmount: "100000000000000" }, rich);
  assert.equal(terms.advanceAmount, LIMITS.absoluteCapBaseUnits);
});
