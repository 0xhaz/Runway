import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RevenueEvent } from "@runway/shared";
import { computeFeatures } from "./features.ts";

const DAY = 86_400;
const asOf = 100 * DAY; // fixed reference so windows are deterministic

function ev(daysAgo: number, amount: string, payer: string): RevenueEvent {
  return { timestamp: asOf - daysAgo * DAY, amount, payer };
}

test("empty history yields zeroed features", () => {
  const f = computeFeatures([], "m", "a", 9);
  assert.equal(f.trailing30d, "0");
  assert.equal(f.distinctPayers, 0);
  assert.equal(f.observedDays, 0);
});

test("trailing windows sum the right events", () => {
  const events = [
    ev(1, "100", "p1"),
    ev(10, "200", "p2"),
    ev(45, "400", "p1"), // outside 30d, inside 60d
    ev(80, "800", "p3"), // outside 60d, inside 90d
  ];
  const f = computeFeatures(events, "m", "a", 9);
  assert.equal(f.trailing30d, "300"); // 100 + 200
  assert.equal(f.trailing60d, "700"); // + 400
  assert.equal(f.trailing90d, "1500"); // + 800
  assert.equal(f.distinctPayers, 3);
});

test("payer concentration reflects the largest payer's share", () => {
  const events = [ev(1, "900", "whale"), ev(2, "100", "minnow")];
  const f = computeFeatures(events, "m", "a", 9);
  assert.equal(f.payerConcentration, 0.9);
});

test("week-over-week trend compares the two most recent weeks", () => {
  const events = [ev(2, "200", "p1"), ev(9, "100", "p1")]; // thisWk 200, lastWk 100
  const f = computeFeatures(events, "m", "a", 9);
  assert.equal(f.weekOverWeekTrend, 1); // +100%
});
