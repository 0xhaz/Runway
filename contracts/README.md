# /contracts — Odra smart contracts

> Odra 2.8.2 (Rust → WASM) on Casper Testnet. See architecture.md §6, techstacks.md §1.
> **Not yet scaffolded** — generated in workplan.md Phase 1 (contract spike).

## Setup (Phase 1)

```bash
cargo install cargo-odra --version 0.1.7 --locked
rustup target add wasm32-unknown-unknown
cd contracts
cargo odra new --name runway_advance   # generates the Odra project here
```

Pin in `Cargo.toml`: `odra = "2.8.2"`. Do not float.

## Contracts

### `RunwayAdvance` (core primitive — Phase 2)

**State** (architecture.md §6.1):
```
principal:   Mapping<AdvanceId, U256>   // original advance amount
owed:        Mapping<AdvanceId, U256>   // remaining to repay (principal * cap)
sweepPct:    Mapping<AdvanceId, u16>    // basis points swept per incoming payment
merchant:    Mapping<AdvanceId, Address>
asset:       Address                    // CEP-18 package hash of financing token
status:      Mapping<AdvanceId, Status> // Active | Repaid | Defaulted
poolBalance: U256                       // capital available to disburse
policySigner: Address                   // the guardrail layer's authorized key
```

**Entry points** (architecture.md §6.2):
```
open_advance(merchant, principal, sweepPct, cap)  // policySigner ONLY
repay(advanceId, amount)                          // decrements owed
fund_pool(amount) / withdraw_pool(amount)         // LP side
close / mark_default(advanceId)                   // admin/policy only
get_advance(advanceId) -> AdvanceView             // dashboard read model
```

**Enforcement guarantees** (architecture.md §6.3 — the headline safety story):
- `open_advance` gated to `policySigner` via Odra **Access Control** module.
- `owed` and `sweepPct` set once at open, immutable for the advance's life.
- Pool sufficiency re-checked on disburse; can never over-lend the pool.

### `RunwayReceiver` (Option A splitter — Phase 4, if time)

Optional payment splitter set as the merchant's x402 `payTo`. On receipt splits
`sweepPct` → `repay()`, remainder → merchant. Fully on-chain, stronger trust
story. Only build after Phase 1 confirms how x402 `/settle` deposits into the
merchant account. **Option B (indexer-driven `repay()`) is the always-shippable fallback.**

## Deploying to Testnet (Odra livenet)

`bin/deploy.rs` deploys a demo CEP-18 token (RunwayUSD) **and** RunwayAdvance, sets
`owner` + `policy_signer` to the deploying account, and self-funds the pool — so the
demo needs no pre-existing `ASSET_PACKAGE_HASH`.

Prereqs:
1. Put the **funded** deployer/policy-signer secret key at `secrets/policy_signer.pem`
   (the account must hold Testnet CSPR — fund its public key at the faucet).
2. Config is in `runway_advance/casper-test.env` (node address, chain name, key path).

Run:
```bash
cd contracts/runway_advance
ODRA_CASPER_LIVENET_ENV=casper-test \
  cargo run --bin deploy --features livenet --release
```

It prints `ASSET_PACKAGE_HASH=…` and `RUNWAY_ADVANCE_CONTRACT_HASH=…` — copy both into
the root `.env`. (Gated behind the `livenet` feature, so the default wasm build/tests
never pull the livenet backend.)

## Testnet proof (fill in for README + submission)
- RunwayAdvance deploy hash: `TBD`
- open_advance tx: `TBD`
- repay (sweep) tx: `TBD`
- close tx: `TBD`
