import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RevenueFeatures } from "@runway/shared";
import { deliberate, type DeliberationInput } from "./deliberation.ts";

const features = (over: Partial<RevenueFeatures> = {}): RevenueFeatures => ({
  merchant: "m",
  asset: "a",
  decimals: 9,
  trailing30d: "100000000000",
  trailing60d: "190000000000",
  trailing90d: "270000000000",
  weekOverWeekTrend: 0.05,
  volatility: 0.2,
  payerConcentration: 0.2,
  distinctPayers: 20,
  observedDays: 80,
  ...over,
});

const base: DeliberationInput = {
  amount: 20_000_000_000n, // 20% of a 100 treasury
  treasuryBalance: 100_000_000_000n,
  features: features(),
};

test("healthy proposal is APPROVED (both agents approve)", () => {
  const r = deliberate(base);
  assert.equal(r.decision, "APPROVED");
  assert.equal(r.approvals, 2);
  assert.equal(r.vetoed, false);
});

test("oversized advance is VETOED by the risk agent", () => {
  const r = deliberate({ ...base, amount: 80_000_000_000n }); // 80% > 50% cap
  assert.equal(r.decision, "BLOCKED");
  assert.equal(r.vetoed, true);
  assert.ok(r.verdicts.find((v) => v.agent === "risk")!.reason.includes("size"));
});

test("payer-concentrated merchant is VETOED by the risk agent", () => {
  const r = deliberate({ ...base, features: features({ payerConcentration: 0.95 }) });
  assert.equal(r.decision, "BLOCKED");
  assert.ok(r.verdicts.find((v) => v.agent === "risk")!.reason.includes("concentration"));
});

test("insolvent advance is VETOED by the treasury agent", () => {
  const r = deliberate({ ...base, amount: 200_000_000_000n }); // > treasury
  assert.equal(r.decision, "BLOCKED");
  const tv = r.verdicts.find((v) => v.agent === "treasury")!;
  assert.equal(tv.position, "veto");
});
