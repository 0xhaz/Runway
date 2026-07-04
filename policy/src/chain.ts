/**
 * On-chain interaction for the policy layer: sign + submit `open_advance` on the
 * deployed RunwayAdvance contract, as the policy signer.
 *
 * "The agent reasons, the protocol decides, the contract enforces." This is the
 * decides→enforces boundary: only the policy signer's key can open an advance, and
 * the contract independently re-checks every rule.
 */
import { readFileSync } from "node:fs";
import {
  Args,
  CLValue,
  ContractCallBuilder,
  HttpHandler,
  Key,
  KeyAlgorithm,
  PrivateKey,
  PublicKey,
  RpcClient,
} from "casper-js-sdk";
import type { ApprovedTerms } from "@runway/shared";

export interface ChainConfig {
  nodeRpcUrl: string; // e.g. https://node.testnet.casper.network/rpc
  chainName: string; // e.g. casper-test
  contractPackageHash: string; // RunwayAdvance package hash (hash- prefix optional)
  signerKeyPath: string; // PEM path
  /** gas for the open_advance call, in motes. */
  gasMotes?: number;
}

export function chainConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ChainConfig {
  const contract = env.RUNWAY_ADVANCE_CONTRACT_HASH;
  const signerKeyPath = env.POLICY_SIGNER_SECRET_KEY_PATH;
  if (!contract) throw new Error("RUNWAY_ADVANCE_CONTRACT_HASH is not set");
  if (!signerKeyPath) throw new Error("POLICY_SIGNER_SECRET_KEY_PATH is not set");
  return {
    nodeRpcUrl: env.CASPER_NODE_RPC_URL ?? "https://node.testnet.casper.network/rpc",
    chainName: env.CASPER_NETWORK ?? "casper-test",
    contractPackageHash: contract,
    signerKeyPath,
    gasMotes: env.OPEN_ADVANCE_GAS_MOTES ? Number(env.OPEN_ADVANCE_GAS_MOTES) : undefined,
  };
}

/** Load an Ed25519 or Secp256k1 secret key from a PEM (auto-detecting the algorithm). */
export function loadSigner(pemPath: string): PrivateKey {
  const pem = readFileSync(pemPath, "utf8");
  try {
    return PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  } catch {
    return PrivateKey.fromPem(pem, KeyAlgorithm.SECP256K1);
  }
}

/**
 * Build a Casper `Key` (account) from a flexible merchant identifier:
 * a public-key hex (01…/02…), an `account-hash-…` string, or a raw 64-char hash.
 */
export function merchantKey(merchant: string): Key {
  const m = merchant.trim();
  if (/^0[12][0-9a-fA-F]{64,}$/.test(m)) {
    // public key hex → account hash
    const hex = PublicKey.fromHex(m).accountHash().toHex();
    return Key.newKey(`account-hash-${hex}`);
  }
  if (m.startsWith("account-hash-")) return Key.newKey(m);
  return Key.newKey(`account-hash-${m.replace(/^account-hash-/, "")}`);
}

export interface OpenAdvanceResult {
  txHash: string;
  merchant: string;
  principal: string;
  sweepPct: number;
  capBps: number;
}

/**
 * Sign and submit `open_advance(merchant, principal, sweep_pct, cap_bps)` on the
 * RunwayAdvance contract as the policy signer, and return the transaction hash.
 */
export async function signAndOpenAdvance(
  cfg: ChainConfig,
  terms: ApprovedTerms,
  merchant: string,
): Promise<OpenAdvanceResult> {
  const signer = loadSigner(cfg.signerKeyPath);
  const contract = cfg.contractPackageHash.replace(/^hash-/, "");
  const capBps = Math.round(terms.repaymentCap * 10_000);

  const args = Args.fromMap({
    merchant: CLValue.newCLKey(merchantKey(merchant)),
    principal: CLValue.newCLUInt256(terms.advanceAmount),
    sweep_pct: CLValue.newCLUInt32(terms.sweepPct),
    cap_bps: CLValue.newCLUInt32(capBps),
  });

  const tx = new ContractCallBuilder()
    .byPackageHash(contract)
    .entryPoint("open_advance")
    .runtimeArgs(args)
    .chainName(cfg.chainName)
    .from(signer.publicKey)
    .payment(cfg.gasMotes ?? 10_000_000_000)
    .build();

  tx.sign(signer);

  const rpc = new RpcClient(new HttpHandler(cfg.nodeRpcUrl));
  await rpc.putTransaction(tx);

  return {
    txHash: tx.hash.toHex(),
    merchant,
    principal: terms.advanceAmount,
    sweepPct: terms.sweepPct,
    capBps,
  };
}
