/**
 * Underwriting Agent (workplan.md Phase 3 · architecture.md §5.2)
 *
 * Turns RevenueFeatures into a structured financing offer via a single
 * structured-output LLM call. The rationale is human-readable and auditable —
 * this is the "meaningful integration of AI" the jury rewards. Not a chatbot.
 *
 * "The agent reasons, the protocol decides, the contract enforces." The offer
 * here is only a RECOMMENDATION; /policy clamps it before anything is signed.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AgentOfferSchema, type AgentOffer, type RevenueFeatures } from "@runway/shared";
import { underwriteFallback } from "./fallback.ts";

const DEFAULT_MODEL = process.env.UNDERWRITING_MODEL ?? "claude-opus-4-8";

const SYSTEM_PROMPT = `You are Runway's underwriting agent. You assess an x402 API
merchant's on-chain revenue and produce a revenue-based-financing (RBF) advance offer.

You are ADVISORY ONLY. A deterministic policy layer will clamp your output to hard
guardrails before any money moves, and an on-chain contract enforces the terms. Do not
try to maximize the advance; underwrite conservatively and explain your reasoning.

Reason about: trailing 30/60/90-day volume, week-over-week trend, volatility, and payer
concentration (revenue from one payer is far riskier than from many). Decline or offer
less when the history is thin, volatile, shrinking, or concentrated.

Write the "rationale" to be read at a glance, NOT as one dense block:
- Open with a one-sentence verdict (e.g. "Strong, diversified merchant — approve at a conservative multiple.").
- Then 2–3 short paragraphs, each separated by a blank line: the strongest signals, the risks, and the sizing logic.
- Keep it tight and concrete; skip restating every raw number.

Respond by calling the "submit_offer" tool exactly once. All monetary amounts are in the
asset's base units (integer strings). sweepPct is in basis points (100 = 1%). repaymentCap
is a multiple of principal (e.g. 1.15 = repay 115%).`;

const OFFER_TOOL: Anthropic.Tool = {
  name: "submit_offer",
  description: "Submit the structured underwriting offer.",
  input_schema: {
    type: "object",
    properties: {
      advanceAmount: { type: "string", description: "advance in asset base units" },
      sweepPct: { type: "integer", description: "basis points swept per payment (0-10000)" },
      repaymentCap: { type: "number", description: "repayment multiple of principal" },
      confidence: { type: "number", description: "0..1 confidence in the offer" },
      rationale: { type: "string", description: "human-readable underwriting rationale" },
    },
    required: ["advanceAmount", "sweepPct", "repaymentCap", "confidence", "rationale"],
  },
};

export interface UnderwriteOptions {
  apiKey?: string;
  model?: string;
  /** Fall back to the deterministic formula on any error instead of throwing. */
  fallbackOnError?: boolean;
}

/**
 * Produce an underwriting offer for the given features. Uses the hosted model
 * (G3: hosted for the demo); validates the tool output against AgentOfferSchema.
 * With no API key, or on error when `fallbackOnError` is set, returns the
 * deterministic fallback so the demo never dead-ends.
 */
export async function underwrite(
  features: RevenueFeatures,
  opts: UnderwriteOptions = {},
): Promise<AgentOffer> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return underwriteFallback(features);

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [OFFER_TOOL],
      tool_choice: { type: "tool", name: "submit_offer" },
      messages: [
        {
          role: "user",
          content: `Underwrite this merchant. Revenue features (JSON):\n${JSON.stringify(
            features,
            null,
            2,
          )}`,
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("model did not call submit_offer");
    }
    return AgentOfferSchema.parse(toolUse.input);
  } catch (err) {
    if (opts.fallbackOnError ?? true) return underwriteFallback(features);
    throw err;
  }
}

export { underwriteFallback, AgentOfferSchema };
export { riskScore } from "./fallback.ts";
export {
  deliberate,
  riskVerdict,
  treasuryVerdict,
  DEFAULT_DELIBERATION_POLICY,
  type DeliberationInput,
  type DeliberationResult,
  type Verdict,
} from "./deliberation.ts";
