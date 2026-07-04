/**
 * TreasuryDAO on-chain calls — the governance layer for the "Treasury Yield" pool.
 *
 * The DAO holds TDAO and releases it only when `approvals >= threshold AND not
 * vetoed`, enforced on-chain. Runway funds a Treasury-pool advance by proposing a
 * disbursement to the pool; the DAO's risk + treasury agents deliberate; the
 * execution agent fires `execute`, which transfers TDAO into the pool.
 *
 * Entry points (from Hackathons/Casper treasury_dao.rs):
 *   create_proposal(recipient: Key, amount: U256, memo: String) -> u32
 *   approve(proposal_id: u32)     // agent only
 *   veto(proposal_id: u32, reason: String)  // agent only
 *   execute(proposal_id: u32)     // agent only; the on-chain gate
 */
import {
  Args,
  CLValue,
  ContractCallBuilder,
  HttpHandler,
  Key,
  RpcClient,
} from "casper-js-sdk";
import { loadSigner, signAndOpenAdvance, type ChainConfig } from "./chain.ts";
import type { PrivateKey } from "casper-js-sdk";
import type { ApprovedTerms } from "@runway/shared";

export interface DaoConfig {
  nodeRpcUrl: string;
  chainName: string;
  daoPackageHash: string; // TreasuryDAO package (hash- prefix optional)
  /** PEM paths for the whitelisted agents. */
  agentKeyPaths: { treasury: string; risk: string; execution: string };
  gasMotes?: number;
}

export function daoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DaoConfig {
  const dao = env.TREASURY_DAO_CONTRACT_HASH;
  if (!dao) throw new Error("TREASURY_DAO_CONTRACT_HASH is not set");
  const dir = env.DAO_AGENT_KEYS_DIR;
  if (!dir) throw new Error("DAO_AGENT_KEYS_DIR is not set (dir with treasury/risk/execution keys)");
  return {
    nodeRpcUrl: env.CASPER_NODE_RPC_URL ?? "https://node.testnet.casper.network/rpc",
    chainName: env.CASPER_NETWORK ?? "casper-test",
    daoPackageHash: dao,
    agentKeyPaths: {
      treasury: `${dir}/treasury/secret_key.pem`,
      risk: `${dir}/risk/secret_key.pem`,
      execution: `${dir}/execution/secret_key.pem`,
    },
    gasMotes: env.DAO_GAS_MOTES ? Number(env.DAO_GAS_MOTES) : undefined,
  };
}

/** Build a Key for a proposal recipient — an account hash or a contract package (hash-…). */
export function recipientKey(recipient: string): Key {
  const r = recipient.trim();
  if (r.startsWith("hash-")) return Key.newKey(r); // contract package (the pool)
  if (r.startsWith("account-hash-")) return Key.newKey(r);
  return Key.newKey(`account-hash-${r.replace(/^account-hash-/, "")}`);
}

function rpc(cfg: DaoConfig) {
  return new RpcClient(new HttpHandler(cfg.nodeRpcUrl));
}

function daoTx(
  cfg: DaoConfig,
  from: PrivateKey,
  entryPoint: string,
  args: Args,
  gas: number,
) {
  const tx = new ContractCallBuilder()
    .byPackageHash(cfg.daoPackageHash.replace(/^hash-/, ""))
    .entryPoint(entryPoint)
    .runtimeArgs(args)
    .chainName(cfg.chainName)
    .from(from.publicKey)
    .payment(gas)
    .build();
  tx.sign(from);
  return tx;
}

async function submit(cfg: DaoConfig, tx: ReturnType<typeof daoTx>): Promise<string> {
  await rpc(cfg).putTransaction(tx);
  return tx.hash.toHex();
}

/** Create a disbursement proposal (proposer pays gas; anyone may propose). */
export async function createProposal(
  cfg: DaoConfig,
  proposer: PrivateKey,
  p: { recipient: string; amount: string; memo: string },
): Promise<string> {
  const args = Args.fromMap({
    recipient: CLValue.newCLKey(recipientKey(p.recipient)),
    amount: CLValue.newCLUInt256(p.amount),
    memo: CLValue.newCLString(p.memo),
  });
  return submit(cfg, daoTx(cfg, proposer, "create_proposal", args, cfg.gasMotes ?? 8_000_000_000));
}

export async function approve(cfg: DaoConfig, agent: PrivateKey, proposalId: number): Promise<string> {
  const args = Args.fromMap({ proposal_id: CLValue.newCLUInt32(proposalId) });
  return submit(cfg, daoTx(cfg, agent, "approve", args, cfg.gasMotes ?? 5_000_000_000));
}

export async function veto(
  cfg: DaoConfig,
  agent: PrivateKey,
  proposalId: number,
  reason: string,
): Promise<string> {
  const args = Args.fromMap({
    proposal_id: CLValue.newCLUInt32(proposalId),
    reason: CLValue.newCLString(reason),
  });
  return submit(cfg, daoTx(cfg, agent, "veto", args, cfg.gasMotes ?? 5_000_000_000));
}

export async function execute(cfg: DaoConfig, execution: PrivateKey, proposalId: number): Promise<string> {
  const args = Args.fromMap({ proposal_id: CLValue.newCLUInt32(proposalId) });
  return submit(cfg, daoTx(cfg, execution, "execute", args, cfg.gasMotes ?? 10_000_000_000));
}

export function loadAgents(cfg: DaoConfig) {
  return {
    treasury: loadSigner(cfg.agentKeyPaths.treasury),
    risk: loadSigner(cfg.agentKeyPaths.risk),
    execution: loadSigner(cfg.agentKeyPaths.execution),
  };
}

/** Best-effort wait for a transaction to finalize (bounded). */
async function confirm(cfg: DaoConfig, txHash: string, timeoutMs = 90_000): Promise<void> {
  const client = rpc(cfg);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await client.getTransactionByTransactionHash(txHash);
      if (res?.executionInfo?.executionResult) return;
    } catch {
      /* not yet indexed */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

export interface DaoAdvanceResult {
  proposalId: number;
  proposalTx: string;
  approveTreasuryTx: string;
  approveRiskTx: string;
  executeTx: string;
  openAdvanceTx: string;
}

/**
 * The full agent-governed funding flow for a Treasury-pool advance:
 *   execution: create_proposal(recipient = pool, amount = principal)
 *   treasury:  approve   risk: approve         (both sign their own approval)
 *   execution: execute   → releases TDAO into the pool (the on-chain gate)
 *   policy:    open_advance → disburses to the merchant, tracks owed/sweep
 *
 * Each step waits for finalization. `proposalId` must be the DAO's current next_id
 * (the orchestrator is the sole creator during the demo).
 */
export async function daoFundAndOpenAdvance(
  daoCfg: DaoConfig,
  chainCfg: ChainConfig,
  params: { poolPackageHash: string; terms: ApprovedTerms; merchant: string; proposalId: number },
): Promise<DaoAdvanceResult> {
  const agents = loadAgents(daoCfg);
  const { poolPackageHash, terms, merchant, proposalId } = params;

  const proposalTx = await createProposal(daoCfg, agents.execution, {
    recipient: poolPackageHash,
    amount: terms.advanceAmount,
    memo: `Runway RBF advance → ${merchant.slice(0, 10)}`,
  });
  await confirm(daoCfg, proposalTx);

  const approveTreasuryTx = await approve(daoCfg, agents.treasury, proposalId);
  await confirm(daoCfg, approveTreasuryTx);
  const approveRiskTx = await approve(daoCfg, agents.risk, proposalId);
  await confirm(daoCfg, approveRiskTx);

  const executeTx = await execute(daoCfg, agents.execution, proposalId);
  await confirm(daoCfg, executeTx);

  // Pool now holds the released TDAO — disburse to the merchant.
  const open = await signAndOpenAdvance(
    { ...chainCfg, contractPackageHash: poolPackageHash },
    terms,
    merchant,
  );

  return {
    proposalId,
    proposalTx,
    approveTreasuryTx,
    approveRiskTx,
    executeTx,
    openAdvanceTx: open.txHash,
  };
}
