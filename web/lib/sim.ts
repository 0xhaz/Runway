/**
 * Client-side advance-lifecycle simulation for the demo. Mirrors the on-chain
 * RunwayAdvance.repay logic: each incoming x402 payment has `sweepPct` routed to
 * repayment, and only `min(swept, owed)` is ever applied. Once the live contract
 * + CSPR.click acceptance are wired, this is replaced by real chain reads.
 */
import type { ApprovedTerms } from "@runway/shared";
import type { Deliberation, DaoAdvanceTrace } from "./api";

export interface RepayTx {
  paymentAmount: string; // base units of the incoming x402 payment
  swept: string; // base units routed to repayment
  txHash: string;
}

export interface SimAdvance {
  principal: string;
  owedInitial: string;
  owed: string;
  sweepPct: number;
  repaymentCap: number;
  status: "Active" | "Repaid";
  openTxHash: string;
  payments: RepayTx[];
  poolName: string;
  assetSymbol: string;
  governed: boolean;
  deliberation?: Deliberation;
  dao?: DaoAdvanceTrace;
}

export function fakeTxHash(): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 64; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

export function createAdvance(
  terms: ApprovedTerms,
  openTxHash: string | undefined,
  meta: {
    poolName: string;
    assetSymbol: string;
    governed: boolean;
    deliberation?: Deliberation;
    dao?: DaoAdvanceTrace;
  },
): SimAdvance {
  return {
    principal: terms.advanceAmount,
    owedInitial: terms.owed,
    owed: terms.owed,
    sweepPct: terms.sweepPct,
    repaymentCap: terms.repaymentCap,
    status: "Active",
    openTxHash: meta.dao?.openAdvanceTx ?? openTxHash ?? fakeTxHash(),
    payments: [],
    poolName: meta.poolName,
    assetSymbol: meta.assetSymbol,
    governed: meta.governed,
    deliberation: meta.deliberation,
    dao: meta.dao,
  };
}

/** An incoming x402 payment arrives; sweep its `sweepPct` toward repayment. */
export function applyPayment(a: SimAdvance, paymentBase: bigint): SimAdvance {
  if (a.status === "Repaid") return a;
  const owed = BigInt(a.owed);
  const swept0 = (paymentBase * BigInt(a.sweepPct)) / 10_000n;
  const swept = swept0 > owed ? owed : swept0;
  const owedNext = owed - swept;
  return {
    ...a,
    owed: owedNext.toString(),
    status: owedNext === 0n ? "Repaid" : "Active",
    payments: [
      ...a.payments,
      { paymentAmount: paymentBase.toString(), swept: swept.toString(), txHash: fakeTxHash() },
    ],
  };
}

/** Fraction repaid in [0,1]. */
export function repaidFraction(a: SimAdvance): number {
  const init = Number(a.owedInitial);
  if (init === 0) return 1;
  return 1 - Number(a.owed) / init;
}
