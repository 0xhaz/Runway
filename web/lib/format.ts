/** Display helpers for CEP-18 base units, basis points, and addresses. */

/** Format base units (bigint string) as a human token amount with `decimals`. */
export function formatUnits(base: string, decimals = 9, maxFrac = 2): string {
  const neg = base.startsWith("-");
  const digits = (neg ? base.slice(1) : base).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  const wholeGrouped = Number(whole).toLocaleString("en-US");
  const out = frac ? `${wholeGrouped}.${frac.slice(0, maxFrac)}` : wholeGrouped;
  return neg ? `-${out}` : out;
}

/** basis points → percent string, e.g. 1500 → "15%". */
export function bpsToPct(bps: number, frac = 0): string {
  return `${(bps / 100).toFixed(frac)}%`;
}

export function pct(x: number, frac = 0): string {
  return `${(x * 100).toFixed(frac)}%`;
}

/** Shorten an on-chain address/hash for display. */
export function shortHash(h: string, lead = 6, tail = 4): string {
  if (h.length <= lead + tail + 1) return h;
  return `${h.slice(0, lead)}…${h.slice(-tail)}`;
}
