/**
 * @runway/shared — types shared across indexer, agent, policy, and web.
 *
 * These mirror the on-chain RunwayAdvance contract (architecture.md §6) and the
 * agent→policy→contract data flow. Keep this in sync with the Odra contract ABI;
 * freeze it early so downstream packages stabilize (workplan.md §6).
 */
import { z } from "zod";

/** Amounts are CEP-18 base units (string to avoid JS number precision loss). */
export type BaseUnits = string;

// ── Revenue indexer output ──────────────────────────────────────────────────

/** A single incoming x402 payment reconstructed from chain data. */
export const RevenueEventSchema = z.object({
  timestamp: z.number().int(), // unix seconds
  amount: z.string(), // CEP-18 base units
  payer: z.string(), // payer account/public-key hash
});
export type RevenueEvent = z.infer<typeof RevenueEventSchema>;

/** Derived features the agent reasons over (not raw txs — keep the prompt tight). */
export const RevenueFeaturesSchema = z.object({
  merchant: z.string(),
  asset: z.string(), // CEP-18 package hash
  decimals: z.number().int(),
  trailing30d: z.string(),
  trailing60d: z.string(),
  trailing90d: z.string(),
  weekOverWeekTrend: z.number(), // fractional, e.g. 0.12 = +12%
  volatility: z.number(), // coefficient of variation of daily volume
  payerConcentration: z.number(), // 0..1, share from the single largest payer
  distinctPayers: z.number().int(),
  observedDays: z.number().int(),
});
export type RevenueFeatures = z.infer<typeof RevenueFeaturesSchema>;

// ── Underwriting agent output ───────────────────────────────────────────────

/** Strict structured offer the LLM must emit; validated before it hits policy. */
export const AgentOfferSchema = z.object({
  advanceAmount: z.string(), // base units
  sweepPct: z.number().int().min(0).max(10000), // basis points
  repaymentCap: z.number(), // multiple of principal, e.g. 1.15
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});
export type AgentOffer = z.infer<typeof AgentOfferSchema>;

// ── Policy / guardrail output ───────────────────────────────────────────────

/** Terms after deterministic clamping — what the policy signer authorizes. */
export const ApprovedTermsSchema = z.object({
  merchant: z.string(),
  advanceAmount: z.string(),
  sweepPct: z.number().int().min(0).max(10000),
  repaymentCap: z.number(),
  owed: z.string(), // advanceAmount * repaymentCap, base units
  clamped: z.boolean(), // true if policy modified the agent's raw offer
  clampNotes: z.array(z.string()),
});
export type ApprovedTerms = z.infer<typeof ApprovedTermsSchema>;

// ── On-chain advance read model (dashboard) ─────────────────────────────────

export type AdvanceStatus = "Active" | "Repaid" | "Defaulted";

export const AdvanceViewSchema = z.object({
  advanceId: z.string(),
  merchant: z.string(),
  principal: z.string(),
  owed: z.string(),
  sweepPct: z.number().int(),
  status: z.enum(["Active", "Repaid", "Defaulted"]),
});
export type AdvanceView = z.infer<typeof AdvanceViewSchema>;
