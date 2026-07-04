/**
 * CEP-18 base-unit math. Amounts are integers held as decimal strings (bigint)
 * to avoid JS float precision loss. A "fraction" is expressed in basis points
 * (bps): 10000 bps = 1.0.
 */

export const BPS = 10000n;

export function toBig(x: string): bigint {
  return BigInt(x);
}

/** Multiply a base-unit amount by a bps fraction, floor-rounded. */
export function mulBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(Math.round(bps))) / BPS;
}

/** min/max over bigints. */
export function bigMin(...xs: bigint[]): bigint {
  return xs.reduce((a, b) => (a < b ? a : b));
}
export function bigMax(...xs: bigint[]): bigint {
  return xs.reduce((a, b) => (a > b ? a : b));
}

/** Clamp an integer (number) into [lo, hi]. */
export function clampInt(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Clamp a float into [lo, hi]. */
export function clampFloat(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
