/**
 * CSPR.cloud client — live revenue reconstruction for the Runway indexer.
 *
 * REST:      GET /ft-token-actions   (historical CEP-18 transfers)
 * Streaming: wss .../ft-token-actions (live CEP-18 transfers)
 *
 * Both authenticate with the access token in the `authorization` header.
 * Docs: https://docs.cspr.cloud (rest-api / streaming-api → fungible token action)
 */
import WebSocket from "ws";
import type { RevenueEvent } from "@runway/shared";

export interface CsprCloudConfig {
  restUrl: string; // e.g. https://api.testnet.cspr.cloud
  streamingUrl: string; // e.g. wss://streaming.testnet.cspr.cloud
  apiKey: string;
}

/** One fungible-token action as returned by CSPR.cloud. */
interface FTTokenAction {
  amount: string;
  contract_package_hash: string;
  deploy_hash: string;
  block_height: number;
  from_hash: string | null;
  from_type: number | null;
  to_hash: string | null;
  to_type: number | null;
  ft_action_type_id: number;
  timestamp: string; // ISO 8601
  transform_idx: number;
}

interface Paginated<T> {
  data: T[];
  item_count: number;
  page_count: number;
}

const PAGE_SIZE = 250; // CSPR.cloud max

/** Strip a leading `account-hash-` prefix if present and lowercase. */
export function normalizeHash(h: string): string {
  return h.replace(/^account-hash-/i, "").toLowerCase();
}

function toUnixSeconds(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

async function getJson<T>(cfg: CsprCloudConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.restUrl}${path}`, {
    headers: { authorization: cfg.apiKey },
  });
  if (!res.ok) {
    throw new Error(`CSPR.cloud ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Resolve the numeric id of the "transfer" fungible-token action type, so we can
 * exclude mints/burns from the revenue series. Cached per process.
 */
let transferTypeIdCache: number | null = null;
export async function resolveTransferTypeId(cfg: CsprCloudConfig): Promise<number> {
  if (transferTypeIdCache !== null) return transferTypeIdCache;
  const res = await getJson<Paginated<{ id: number; name: string }>>(
    cfg,
    `/ft-token-action-types?page_size=${PAGE_SIZE}`,
  );
  const transfer = res.data.find((t) => t.name.toLowerCase() === "transfer");
  if (!transfer) throw new Error("CSPR.cloud: no 'transfer' ft action type found");
  transferTypeIdCache = transfer.id;
  return transfer.id;
}

/**
 * Reconstruct a merchant's incoming CEP-18 revenue: all `transfer` actions of
 * `assetPackageHash` whose recipient (`to_hash`) is the merchant account.
 */
export async function fetchRevenueHistory(
  cfg: CsprCloudConfig,
  merchant: string,
  assetPackageHash: string,
): Promise<RevenueEvent[]> {
  const merchantHash = normalizeHash(merchant);
  const asset = normalizeHash(assetPackageHash);
  const transferId = await resolveTransferTypeId(cfg);

  const events: RevenueEvent[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const qs = new URLSearchParams({
      contract_package_hash: asset,
      owner_hash: merchantHash,
      page: String(page),
      page_size: String(PAGE_SIZE),
      order_by: "timestamp",
    });
    const res = await getJson<Paginated<FTTokenAction>>(cfg, `/ft-token-actions?${qs}`);
    pageCount = res.page_count || 1;
    for (const a of res.data) {
      if (a.ft_action_type_id !== transferId) continue;
      if (!a.to_hash || normalizeHash(a.to_hash) !== merchantHash) continue; // incoming only
      events.push({
        timestamp: toUnixSeconds(a.timestamp),
        amount: a.amount,
        payer: a.from_hash ? normalizeHash(a.from_hash) : "unknown",
      });
    }
    page += 1;
  } while (page <= pageCount);

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Subscribe to live incoming CEP-18 transfers for the merchant. Invokes `onEvent`
 * per incoming transfer; returns an unsubscribe function. Drives the live dashboard
 * and, under sweep Option B, triggers repay().
 */
export function subscribeLivePayments(
  cfg: CsprCloudConfig,
  merchant: string,
  assetPackageHash: string,
  onEvent: (e: RevenueEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  const merchantHash = normalizeHash(merchant);
  const asset = normalizeHash(assetPackageHash);
  const url = `${cfg.streamingUrl}/ft-token-actions?contract_package_hash=${asset}&owner_hash=${merchantHash}`;

  const ws = new WebSocket(url, { headers: { authorization: cfg.apiKey } });

  ws.on("message", (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        action?: string;
        data?: FTTokenAction;
      };
      const a = msg.data;
      if (!a || !a.to_hash || !a.from_hash) return; // skip mints/burns (null from/to)
      if (normalizeHash(a.to_hash) !== merchantHash) return; // incoming only
      onEvent({
        timestamp: toUnixSeconds(a.timestamp),
        amount: a.amount,
        payer: a.from_hash ? normalizeHash(a.from_hash) : "unknown",
      });
    } catch (err) {
      onError?.(err as Error);
    }
  });
  ws.on("error", (err) => onError?.(err as Error));

  return () => ws.close();
}
