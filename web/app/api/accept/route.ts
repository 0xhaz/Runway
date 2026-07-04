/**
 * POST /api/accept — open an advance on the chosen pool.
 *
 * - Prime pool: sign + submit open_advance directly (policy signer).
 * - Treasury pool (DAO-governed): the multi-agent DAO deliberates first
 *   (risk + treasury verdicts, on-chain decision rule). A veto BLOCKS the advance
 *   and no funds move; on approval, the advance opens. The key never reaches the
 *   browser. Falls back to simulation when the chain isn't configured.
 */
import { NextResponse } from "next/server";
import {
  signAndOpenAdvance,
  chainConfigFromEnv,
  loadSigner,
  daoConfigFromEnv,
  daoFundAndOpenAdvance,
} from "@runway/policy";
import { deliberate } from "@runway/agent";
import type { ApprovedTerms, RevenueFeatures } from "@runway/shared";
import { POOLS, type PoolId } from "@/lib/pools";

export const runtime = "nodejs";

// Illustrative treasury size when the live balance isn't wired (base units).
const DEFAULT_TREASURY_TDAO = "1000000000000000"; // 1,000,000 TDAO @ 9 decimals

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    terms?: ApprovedTerms;
    merchant?: string;
    poolId?: PoolId;
    features?: RevenueFeatures;
  };
  const terms = body.terms;
  if (!terms) return NextResponse.json({ error: "missing terms" }, { status: 400 });

  const pool = POOLS[body.poolId ?? "prime"];

  // ── DAO governance gate for the Treasury Yield pool ──────────────────────────
  let deliberation;
  if (pool.governed) {
    const treasuryBalance = BigInt(process.env.TREASURY_TDAO_BALANCE ?? DEFAULT_TREASURY_TDAO);
    deliberation = deliberate({
      amount: BigInt(terms.advanceAmount),
      treasuryBalance,
      features: body.features ?? fallbackFeatures(terms),
    });
    if (deliberation.decision === "BLOCKED") {
      // A veto or quorum failure — no capital is released.
      return NextResponse.json({
        simulated: true,
        blocked: true,
        poolId: pool.id,
        deliberation,
        reason: deliberation.reason,
      });
    }

    // Full live agent-governed funding: create_proposal → approve×2 → execute →
    // open_advance. Gated behind DAO_LIVE (fires 5 real transactions moving TDAO).
    if (process.env.DAO_LIVE === "true") {
      try {
        const daoCfg = daoConfigFromEnv();
        const chainCfg = chainConfigFromEnv();
        const poolPackageHash = process.env[pool.contractHashEnv]!;
        const proposalId = Number(process.env.DAO_NEXT_PROPOSAL_ID ?? "0");
        const merchant =
          body.merchant ||
          process.env.MERCHANT_ACCOUNT_HASH ||
          loadSigner(chainCfg.signerKeyPath).publicKey.accountHash().toHex();
        const dao = await daoFundAndOpenAdvance(daoCfg, chainCfg, {
          poolPackageHash,
          terms,
          merchant,
          proposalId,
        });
        return NextResponse.json({
          simulated: false,
          poolId: pool.id,
          deliberation,
          dao,
          txHash: dao.openAdvanceTx,
          merchant,
        });
      } catch (err) {
        return NextResponse.json({
          simulated: true,
          poolId: pool.id,
          deliberation,
          reason: `DAO live flow failed: ${String(err)}`,
        });
      }
    }
  }

  // ── Open the advance (real if the pool's contract is configured) ─────────────
  let cfg;
  try {
    cfg = chainConfigFromEnv();
    const poolHash = process.env[pool.contractHashEnv];
    if (!poolHash) throw new Error(`${pool.contractHashEnv} not set`);
    cfg.contractPackageHash = poolHash;
  } catch (e) {
    return NextResponse.json({
      simulated: true,
      poolId: pool.id,
      deliberation,
      reason: `chain not configured for ${pool.name}: ${String(e)}`,
    });
  }

  const merchant =
    body.merchant ||
    process.env.MERCHANT_ACCOUNT_HASH ||
    loadSigner(cfg.signerKeyPath).publicKey.accountHash().toHex();

  try {
    const result = await signAndOpenAdvance(cfg, terms, merchant);
    return NextResponse.json({ simulated: false, poolId: pool.id, deliberation, ...result });
  } catch (err) {
    return NextResponse.json({
      simulated: true,
      poolId: pool.id,
      deliberation,
      reason: `submit failed: ${String(err)}`,
    });
  }
}

/** Minimal features if the client didn't send them (keeps deliberation defined). */
function fallbackFeatures(terms: ApprovedTerms): RevenueFeatures {
  return {
    merchant: terms.merchant,
    asset: "",
    decimals: 9,
    trailing30d: terms.advanceAmount,
    trailing60d: terms.advanceAmount,
    trailing90d: terms.advanceAmount,
    weekOverWeekTrend: 0,
    volatility: 0.3,
    payerConcentration: 0.3,
    distinctPayers: 10,
    observedDays: 60,
  };
}
