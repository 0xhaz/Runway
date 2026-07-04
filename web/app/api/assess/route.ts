/**
 * POST /api/assess — the underwriting orchestration.
 *
 * Runs the real Runway pipeline server-side:
 *   indexer.computeFeatures → agent.underwrite → policy.applyPolicy
 *
 * Revenue is currently synthesized (lib/mock) because the live CSPR.cloud indexer
 * is gated on an API key; swap generateMockRevenue for indexer.fetchRevenueHistory
 * once CSPR_CLOUD_API_KEY is set. The agent uses the hosted model when
 * ANTHROPIC_API_KEY is present and the deterministic fallback otherwise.
 */
import { NextResponse } from "next/server";
import {
  computeFeatures,
  configFromEnv,
  fetchRevenueHistory,
} from "@runway/indexer";
import { underwrite } from "@runway/agent";
import { applyPolicy } from "@runway/policy";
import type { RevenueEvent } from "@runway/shared";
import { generateMockRevenue, DECIMALS_DEFAULT, type MerchantProfile } from "@/lib/mock";
import { POOL_LIST, targetApy } from "@/lib/pools";

export const runtime = "nodejs";

/**
 * Use live CSPR.cloud revenue when we have both the financing asset and a merchant
 * account to read; otherwise synthesize a demo series. Returns the events and a
 * source label. Live errors degrade gracefully to the synthesized series.
 */
async function loadRevenue(
  profile: MerchantProfile,
  merchant: string,
  asset: string,
  asOf: number,
): Promise<{ events: RevenueEvent[]; source: string }> {
  const assetHash = process.env.ASSET_PACKAGE_HASH;
  const merchantHash = merchant || process.env.MERCHANT_ACCOUNT_HASH;
  if (process.env.CSPR_CLOUD_API_KEY && assetHash && merchantHash) {
    try {
      const events = await fetchRevenueHistory(configFromEnv(), merchantHash, assetHash);
      if (events.length > 0) return { events, source: "cspr.cloud-live" };
      return { events: generateMockRevenue(profile, asOf), source: "synthesized-demo-revenue (no live history)" };
    } catch {
      return { events: generateMockRevenue(profile, asOf), source: "synthesized-demo-revenue (live read failed)" };
    }
  }
  return { events: generateMockRevenue(profile, asOf), source: "synthesized-demo-revenue" };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const profile: MerchantProfile = body.profile ?? "healthy";
  const merchant: string = body.merchant ?? process.env.MERCHANT_ACCOUNT_HASH ?? "acct-merchant-demo";
  const asset: string = body.asset ?? process.env.ASSET_PACKAGE_HASH ?? "cep18-demo-asset";

  const asOf = Math.floor(Date.now() / 1000);

  const { events, source } = await loadRevenue(profile, merchant, asset, asOf);
  const features = computeFeatures(events, merchant, asset, DECIMALS_DEFAULT);
  const offer = await underwrite(features); // hosted if key set, else fallback
  const usedModel = Boolean(process.env.ANTHROPIC_API_KEY);

  // Clamp the same agent offer to each pool's risk appetite → different terms/APY.
  const pools = Object.fromEntries(
    POOL_LIST.map((p) => {
      const terms = applyPolicy(offer, features, p.limits);
      return [p.id, { terms, targetApy: targetApy(p) }];
    }),
  );

  return NextResponse.json({
    profile,
    features,
    offer,
    pools,
    meta: {
      source,
      underwriter: usedModel ? "hosted-model" : "deterministic-fallback",
      events: events.length,
    },
  });
}
