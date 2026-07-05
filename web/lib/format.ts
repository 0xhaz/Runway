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

/**
 * Break a rationale into readable paragraphs. Honors the model's own blank-line
 * breaks; if it returned one dense block, groups ~2 sentences per paragraph.
 */
export function toParagraphs(text: string): string[] {
  const byBlank = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paras.push(sentences.slice(i, i + 2).join(" "));
  }
  return paras;
}
