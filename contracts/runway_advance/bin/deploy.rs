//! Testnet deploy for Runway (Odra livenet backend).
//!
//! Deploys a demo CEP-18 financing token (RunwayUSD) + the RunwayAdvance contract,
//! sets owner + policy_signer to the deploying account, and self-funds the pool.
//! This makes the demo self-contained — no pre-existing ASSET_PACKAGE_HASH needed.
//!
//! Run:
//!   cd contracts/runway_advance
//!   ODRA_CASPER_LIVENET_ENV=casper-test \
//!     cargo run --bin deploy --features livenet --release
//!
//! Requires (see casper-test.env):
//!   ODRA_CASPER_LIVENET_NODE_ADDRESS, ODRA_CASPER_LIVENET_CHAIN_NAME,
//!   ODRA_CASPER_LIVENET_SECRET_KEY_PATH  (the funded deployer = policy signer)
//!
//! After it prints the addresses, copy them into the root .env:
//!   ASSET_PACKAGE_HASH, RUNWAY_ADVANCE_CONTRACT_HASH

use odra::casper_types::U256;
use odra::host::Deployer;
use odra::prelude::Addressable;
use odra_modules::cep18_token::{Cep18, Cep18InitArgs};
use runway_advance::runway_advance::{RunwayAdvance, RunwayAdvanceInitArgs};

// 9-decimal token. 1 RUN = 1e9 base units.
const ONE: u64 = 1_000_000_000;
const INITIAL_SUPPLY_RUN: u64 = 1_000_000; // minted to the deployer
const POOL_FUND_RUN: u64 = 500_000; // self-funded pool

fn main() {
    let env = odra_casper_livenet_env::env();
    let deployer = env.caller();
    println!("Deployer / policy signer: {}", deployer.to_string());

    // 1) Financing token (RunwayUSD). Contract installs are gas-heavy; Casper
    // charges the full offered payment, so these are sized with margin (budget-checked).
    env.set_gas(700_000_000_000u64);
    let mut token = Cep18::deploy(
        &env,
        Cep18InitArgs {
            symbol: String::from("RUN"),
            name: String::from("RunwayUSD"),
            decimals: 9u8,
            initial_supply: U256::from(INITIAL_SUPPLY_RUN) * U256::from(ONE),
        },
    );
    println!("ASSET_PACKAGE_HASH={}", token.address().to_string());

    // 2) RunwayAdvance — owner + policy signer both = deployer for the demo.
    env.set_gas(700_000_000_000u64);
    let mut runway = RunwayAdvance::deploy(
        &env,
        RunwayAdvanceInitArgs {
            owner: deployer,
            policy_signer: deployer,
            asset: token.address(),
        },
    );
    println!("RUNWAY_ADVANCE_CONTRACT_HASH={}", runway.address().to_string());

    // 3) Self-fund the pool: approve then fund_pool.
    let fund = U256::from(POOL_FUND_RUN) * U256::from(ONE);
    env.set_gas(10_000_000_000u64);
    token.approve(&runway.address(), &fund);
    env.set_gas(20_000_000_000u64);
    runway.fund_pool(fund);
    println!("Pool funded: {} RUN", POOL_FUND_RUN);

    println!("\nDone. Copy ASSET_PACKAGE_HASH and RUNWAY_ADVANCE_CONTRACT_HASH into .env.");
}
