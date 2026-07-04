import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RevenueFeatures } from "@runway/shared";
import { AgentOfferSchema } from "@runway/shared";
import { riskScore, underwriteFallback } from "./fallback.ts";

const lowRisk: RevenueFeatures = {
  merchant: "m",
  asset: "a",
  decimals: 9,
  trailing30d: "1000000000",
  trailing60d: "1900000000",
  trailing90d: "2700000000",
  weekOverWeekTrend: 0.1,
  volatility: 0.1,
  payerConcentration: 0.1,
  distinctPayers: 30,
  observedDays: 90,
};

const highRisk: RevenueFeatures = {
  ...lowRisk,
  weekOverWeekTrend: -0.4,
  volatility: 0.9,
  payerConcentration: 0.95,
  distinctPayers: 1,
  observedDays: 10,
};

test("fallback output always validates against the schema", () => {
  assert.doesNotThrow(() => AgentOfferSchema.parse(underwriteFallback(lowRisk)));
  assert.doesNotThrow(() => AgentOfferSchema.parse(underwriteFallback(highRisk)));
});

test("higher risk → higher risk score", () => {
  assert.ok(riskScore(highRisk) > riskScore(lowRisk));
});

test("riskier merchant gets a smaller advance, bigger sweep, higher cap", () => {
  const lo = underwriteFallback(lowRisk);
  const hi = underwriteFallback(highRisk);
  assert.ok(BigInt(hi.advanceAmount) < BigInt(lo.advanceAmount));
  assert.ok(hi.sweepPct > lo.sweepPct);
  assert.ok(hi.repaymentCap >= lo.repaymentCap);
  assert.ok(hi.confidence < lo.confidence);
});
