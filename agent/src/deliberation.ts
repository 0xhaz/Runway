/**
 * Multi-agent DAO deliberation for the Treasury Yield pool.
 *
 * Ported from the TreasuryDAO's agents (Hackathons/Casper): a RISK agent (hard
 * veto on policy breach — size vs treasury, payer concentration, revenue trend)
 * and a TREASURY agent (solvency). The EXECUTION agent is the hand, not a judge.
 * Decision rule mirrors the contract: APPROVED iff approvals >= threshold AND no veto.
 *
 * This is the second agent layer over Runway's own underwriting: an AI underwriter
 * proposes, a multi-agent DAO governs the capital, two contracts enforce.
 */
import type { RevenueFeatures } from "@runway/shared";

export type Position = "approve" | "veto";

export interface Verdict {
  agent: "risk" | "treasury";
  position: Position;
  reason: string;
  evidence: Record<string, number | boolean | string>;
}

export interface DeliberationPolicy {
  /** max advance as a fraction of treasury balance before the risk agent vetoes. */
  maxSizePct: number;
  /** max payer concentration tolerated. */
  maxConcentration: number;
  /** revenue WoW trend below this (e.g. -0.3) is a hard veto. */
  minTrend: number;
}

export const DEFAULT_DELIBERATION_POLICY: DeliberationPolicy = {
  maxSizePct: 0.5,
  maxConcentration: 0.5, // single-payer dependence >50% is a hard RBF risk
  minTrend: -0.3,
};

export interface DeliberationInput {
  amount: bigint; // advance principal, base units
  treasuryBalance: bigint; // TDAO the DAO can disburse
  features: RevenueFeatures;
  policy?: DeliberationPolicy;
  threshold?: number; // approvals required (DAO default 2)
}

export interface DeliberationResult {
  verdicts: Verdict[];
  approvals: number;
  vetoed: boolean;
  threshold: number;
  decision: "APPROVED" | "BLOCKED";
  reason: string;
}

const pctStr = (n: number) => `${(n * 100).toFixed(1)}%`;

/** RISK agent: hard veto on size / concentration / collapsing revenue. */
export function riskVerdict(input: DeliberationInput, policy: DeliberationPolicy): Verdict {
  const { amount, treasuryBalance, features } = input;
  if (treasuryBalance <= 0n) {
    return {
      agent: "risk",
      position: "veto",
      reason: "No readable treasury balance — cannot size the advance.",
      evidence: { treasury_balance: 0 },
    };
  }
  const sizePct = Number(amount) / Number(treasuryBalance);
  const conc = features.payerConcentration;
  const trend = features.weekOverWeekTrend;

  const breachSize = sizePct > policy.maxSizePct;
  const breachConc = conc > policy.maxConcentration;
  const breachTrend = trend < policy.minTrend;
  const position: Position = breachSize || breachConc || breachTrend ? "veto" : "approve";

  const reasons: string[] = [];
  if (breachSize) reasons.push(`size ${pctStr(sizePct)} > treasury cap ${pctStr(policy.maxSizePct)}`);
  if (breachConc) reasons.push(`payer concentration ${pctStr(conc)} > ${pctStr(policy.maxConcentration)}`);
  if (breachTrend) reasons.push(`revenue trend ${pctStr(trend)} below floor ${pctStr(policy.minTrend)}`);

  return {
    agent: "risk",
    position,
    reason:
      position === "veto"
        ? `VETO: ${reasons.join("; ")}.`
        : `Approve: size ${pctStr(sizePct)}, concentration ${pctStr(conc)}, trend ${pctStr(trend)} within policy.`,
    evidence: {
      size_vs_treasury: Number(sizePct.toFixed(4)),
      concentration: Number(conc.toFixed(4)),
      trend: Number(trend.toFixed(4)),
    },
  };
}

/** TREASURY agent: solvency — never disburse more than the treasury holds. */
export function treasuryVerdict(input: DeliberationInput): Verdict {
  const solvent = input.amount <= input.treasuryBalance;
  return {
    agent: "treasury",
    position: solvent ? "approve" : "veto",
    reason: solvent
      ? "Approve: treasury holds sufficient balance to fund this advance."
      : "VETO: advance exceeds treasury balance (insolvent).",
    evidence: {
      amount: input.amount.toString(),
      treasury_balance: input.treasuryBalance.toString(),
    },
  };
}

/** Run the deliberation and apply the on-chain decision rule. */
export function deliberate(input: DeliberationInput): DeliberationResult {
  const policy = input.policy ?? DEFAULT_DELIBERATION_POLICY;
  const threshold = input.threshold ?? 2;
  const verdicts = [riskVerdict(input, policy), treasuryVerdict(input)];
  const vetoed = verdicts.some((v) => v.position === "veto");
  const approvals = verdicts.filter((v) => v.position === "approve").length;
  const decision = !vetoed && approvals >= threshold ? "APPROVED" : "BLOCKED";
  const reason =
    decision === "APPROVED"
      ? `${approvals}/${threshold} approvals, no veto — capital released.`
      : vetoed
        ? verdicts.find((v) => v.position === "veto")!.reason
        : `only ${approvals}/${threshold} approvals — quorum not met.`;
  return { verdicts, approvals, vetoed, threshold, decision, reason };
}
