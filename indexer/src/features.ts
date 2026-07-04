/**
 * Pure feature derivation: RevenueEvent[] → RevenueFeatures.
 *
 * No network — deterministic given the input series, so it's fully unit-testable.
 * Windows are computed relative to the latest event's timestamp (the "as-of" point),
 * which keeps the demo reproducible regardless of wall-clock time.
 */
import type { RevenueEvent, RevenueFeatures } from "@runway/shared";

const DAY = 86_400;

function sumWindow(events: RevenueEvent[], from: number, to: number): bigint {
  let total = 0n;
  for (const e of events) {
    if (e.timestamp > from && e.timestamp <= to) total += BigInt(e.amount);
  }
  return total;
}

/** Ratio of two bigints as a float (for trends/shares — precision-safe enough). */
function ratio(num: bigint, den: bigint): number {
  if (den === 0n) return 0;
  return Number(num) / Number(den);
}

export function computeFeatures(
  events: RevenueEvent[],
  merchant: string,
  asset: string,
  decimals: number,
): RevenueFeatures {
  if (events.length === 0) {
    return {
      merchant,
      asset,
      decimals,
      trailing30d: "0",
      trailing60d: "0",
      trailing90d: "0",
      weekOverWeekTrend: 0,
      volatility: 0,
      payerConcentration: 0,
      distinctPayers: 0,
      observedDays: 0,
    };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const asOf = sorted[sorted.length - 1].timestamp;
  const first = sorted[0].timestamp;

  const trailing30d = sumWindow(sorted, asOf - 30 * DAY, asOf + 1);
  const trailing60d = sumWindow(sorted, asOf - 60 * DAY, asOf + 1);
  const trailing90d = sumWindow(sorted, asOf - 90 * DAY, asOf + 1);

  // Week-over-week trend: last 7d vs the 7d before it.
  const thisWeek = sumWindow(sorted, asOf - 7 * DAY, asOf + 1);
  const lastWeek = sumWindow(sorted, asOf - 14 * DAY, asOf - 7 * DAY);
  const weekOverWeekTrend = lastWeek === 0n ? 0 : ratio(thisWeek - lastWeek, lastWeek);

  // Volatility: coefficient of variation of daily volume over the observed window.
  const byDay = new Map<number, bigint>();
  for (const e of sorted) {
    const day = Math.floor(e.timestamp / DAY);
    byDay.set(day, (byDay.get(day) ?? 0n) + BigInt(e.amount));
  }
  const dailyStart = Math.floor(first / DAY);
  const dailyEnd = Math.floor(asOf / DAY);
  const dailyVolumes: number[] = [];
  for (let d = dailyStart; d <= dailyEnd; d++) {
    dailyVolumes.push(Number(byDay.get(d) ?? 0n));
  }
  const mean = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
  const variance =
    dailyVolumes.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyVolumes.length;
  const volatility = mean === 0 ? 0 : Math.sqrt(variance) / mean;

  // Payer concentration: share of the single largest payer.
  const byPayer = new Map<string, bigint>();
  let total = 0n;
  for (const e of sorted) {
    const amt = BigInt(e.amount);
    byPayer.set(e.payer, (byPayer.get(e.payer) ?? 0n) + amt);
    total += amt;
  }
  const largest = [...byPayer.values()].reduce((a, b) => (a > b ? a : b), 0n);
  const payerConcentration = ratio(largest, total);

  return {
    merchant,
    asset,
    decimals,
    trailing30d: trailing30d.toString(),
    trailing60d: trailing60d.toString(),
    trailing90d: trailing90d.toString(),
    weekOverWeekTrend,
    volatility,
    payerConcentration,
    distinctPayers: byPayer.size,
    observedDays: dailyEnd - dailyStart + 1,
  };
}
