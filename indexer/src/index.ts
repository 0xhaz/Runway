/**
 * Revenue Indexer (workplan.md Phase 3 · architecture.md §5.1)
 *
 * Reconstructs a merchant's x402 revenue history from chain data and derives the
 * features the underwriting agent reasons over.
 *
 *   - REST (CSPR.cloud):      historical CEP-18 transfers into merchant `payTo`
 *   - Streaming (CSPR.cloud): live incoming payments (dashboard + Option-B sweep)
 *
 * `computeFeatures` is pure (./features); the live client is ./cspr-cloud.
 */
export { computeFeatures } from "./features.ts";
export {
  fetchRevenueHistory,
  subscribeLivePayments,
  resolveTransferTypeId,
  normalizeHash,
  type CsprCloudConfig,
} from "./cspr-cloud.ts";

import type { CsprCloudConfig } from "./cspr-cloud.ts";

/** Build a CsprCloudConfig from environment variables. */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): CsprCloudConfig {
  const apiKey = env.CSPR_CLOUD_API_KEY;
  if (!apiKey) throw new Error("CSPR_CLOUD_API_KEY is not set");
  return {
    restUrl: env.CSPR_CLOUD_REST_URL ?? "https://api.testnet.cspr.cloud",
    streamingUrl: env.CSPR_CLOUD_STREAMING_URL ?? "wss://streaming.testnet.cspr.cloud",
    apiKey,
  };
}
