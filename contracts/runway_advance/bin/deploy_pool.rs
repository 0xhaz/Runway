//! Deploy an additional RunwayAdvance pool against an EXISTING CEP-18 asset.
//!
//! Used for the DAO-governed "Treasury Yield" pool: asset = the TreasuryDAO's
//! token (TDAO). The pool is left UNFUNDED — the TreasuryDAO funds it live via a
//! governed `execute` disbursement (pool capital = the contract's token balance).
//!
//! Run:
//!   cd contracts/runway_advance
//!   POOL_ASSET=hash-<cep18-package-hex> \
//!   ODRA_CASPER_LIVENET_ENV=casper-test \
//!     cargo run --bin deploy_pool --features livenet --release
//!
//! Prints RUNWAY_POOL_CONTRACT_HASH — copy it into .env (e.g. TREASURY_POOL_CONTRACT_HASH).

use odra::host::Deployer;
use odra::prelude::*;
use runway_advance::runway_advance::{RunwayAdvance, RunwayAdvanceInitArgs};

fn main() {
    let env = odra_casper_livenet_env::env();
    let deployer = env.caller();

    let asset_str = std::env::var("POOL_ASSET").expect("POOL_ASSET (hash-<hex>) is required");
    let asset = Address::from_str(&asset_str).expect("POOL_ASSET must be a valid hash-<hex> address");

    println!("Deployer / policy signer: {}", deployer.to_string());
    println!("Pool asset: {}", asset.to_string());

    env.set_gas(700_000_000_000u64);
    let runway = RunwayAdvance::deploy(
        &env,
        RunwayAdvanceInitArgs {
            owner: deployer,
            policy_signer: deployer,
            asset,
        },
    );
    println!("RUNWAY_POOL_CONTRACT_HASH={}", runway.address().to_string());
    println!("\nPool deployed unfunded — the TreasuryDAO funds it via a governed execute().");
}
