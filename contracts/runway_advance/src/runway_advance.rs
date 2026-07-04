//! RunwayAdvance — the on-chain settlement layer for Runway.
//!
//! "The agent reasons, the protocol decides, the contract enforces." (architecture.md §3)
//! This contract is sovereign: it disburses a revenue-based advance and then sweeps a
//! fixed percentage of every incoming repayment until the advance is closed. It enforces
//! its rules independently of the off-chain agent/policy layer:
//!
//!   * `open_advance` is callable ONLY by the stored `policy_signer` — the agent layer
//!     literally cannot open an advance the guardrail didn't sign (architecture.md §6.3).
//!   * `owed` and `sweep_pct` are set once at open and are immutable for the advance's life.
//!   * pool sufficiency is re-checked on disburse; the pool can never be over-lent.
//!
//! The financing asset is an external CEP-18 token; all value moves through real
//! cross-contract `transfer` / `transfer_from` calls against it.

use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// Basis-points denominator. 10_000 bps = 1.0.
const BPS: u64 = 10_000;

/// Lifecycle state of a single advance.
/// `#[odra::odra_type]` already derives Debug/Clone/PartialEq/Eq.
#[odra::odra_type]
pub enum Status {
    Active,
    Repaid,
    Defaulted,
}

/// Read model returned to the dashboard.
#[odra::odra_type]
pub struct AdvanceView {
    pub id: u64,
    pub merchant: Address,
    pub principal: U256,
    pub owed: U256,
    pub sweep_pct: u32,
    pub status: Status,
}

// Odra error codes must fit in u16 (<= 65535).
#[odra::odra_error]
pub enum Error {
    /// Caller is not the authorized policy signer.
    NotPolicySigner = 64001,
    /// Caller is not the contract owner/admin.
    NotOwner = 64002,
    /// Pool does not hold enough capital to disburse this advance.
    InsufficientPool = 64003,
    /// Referenced advance id does not exist.
    UnknownAdvance = 64004,
    /// Advance is not Active (already repaid or defaulted).
    NotActive = 64005,
    /// A zero amount was supplied where a positive one is required.
    ZeroAmount = 64006,
    /// sweep_pct out of the valid 0..=10000 bps range.
    InvalidSweepPct = 64007,
    /// repayment cap below 100% (would make the advance a gift).
    InvalidCap = 64008,
}

#[odra::event]
pub struct PoolFunded {
    pub from: Address,
    pub amount: U256,
}

#[odra::event]
pub struct AdvanceOpened {
    pub id: u64,
    pub merchant: Address,
    pub principal: U256,
    pub owed: U256,
    pub sweep_pct: u32,
}

#[odra::event]
pub struct AdvanceRepaid {
    pub id: u64,
    pub amount: U256,
    pub remaining: U256,
}

#[odra::event]
pub struct AdvanceClosed {
    pub id: u64,
    pub status: Status,
}

#[odra::module]
pub struct RunwayAdvance {
    owner: Var<Address>,
    policy_signer: Var<Address>,
    /// CEP-18 token that denominates both revenue and the advance.
    asset: Var<Address>,
    // Pool capital is NOT stored — it is derived from the contract's live CEP-18
    // balance (`balance_of(self)`). This lets any inbound transfer (e.g. a
    // TreasuryDAO `execute` disbursement) fund the pool with no bookkeeping call.
    next_id: Var<u64>,
    principal: Mapping<u64, U256>,
    owed: Mapping<u64, U256>,
    sweep_pct: Mapping<u64, u32>,
    merchant: Mapping<u64, Address>,
    status: Mapping<u64, Status>,
}

#[odra::module]
impl RunwayAdvance {
    /// Deploy with the admin owner, the guardrail's authorized policy signer, and the
    /// CEP-18 financing asset address.
    pub fn init(&mut self, owner: Address, policy_signer: Address, asset: Address) {
        self.owner.set(owner);
        self.policy_signer.set(policy_signer);
        self.asset.set(asset);
        self.next_id.set(0);
    }

    // ── Liquidity provider side ───────────────────────────────────────────────

    /// Fund the pool by pulling `amount` from the caller (who must `approve` first).
    /// Pool capital is the contract's balance, so the transfer alone funds it; a
    /// direct CEP-18 transfer into this contract (e.g. a TreasuryDAO `execute`)
    /// funds the pool equally well.
    pub fn fund_pool(&mut self, amount: U256) {
        self.require_positive(amount);
        let from = self.env().caller();
        self.asset_ref().transfer_from(&from, &self.env().self_address(), &amount);
        self.env().emit_event(PoolFunded { from, amount });
    }

    /// Withdraw idle pool capital back to the owner. Owner-only.
    pub fn withdraw_pool(&mut self, amount: U256) {
        self.assert_owner();
        self.require_positive(amount);
        if amount > self.pool() {
            self.env().revert(Error::InsufficientPool);
        }
        let owner = self.owner.get_or_revert_with(Error::NotOwner);
        self.asset_ref().transfer(&owner, &amount);
    }

    // ── Advance lifecycle ─────────────────────────────────────────────────────

    /// Open a revenue-based advance. **policy_signer only.**
    /// `cap_bps` is the repayment multiple in bps (e.g. 11500 = repay 115% of principal).
    /// Sets `owed = principal * cap_bps / 10000`, immutably, and disburses `principal`
    /// of the asset to the merchant from the pool.
    pub fn open_advance(
        &mut self,
        merchant: Address,
        principal: U256,
        sweep_pct: u32,
        cap_bps: u32,
    ) -> u64 {
        self.assert_policy_signer();
        self.require_positive(principal);
        if sweep_pct == 0 || (sweep_pct as u64) > BPS {
            self.env().revert(Error::InvalidSweepPct);
        }
        if (cap_bps as u64) < BPS {
            self.env().revert(Error::InvalidCap);
        }

        let pool = self.pool();
        if principal > pool {
            self.env().revert(Error::InsufficientPool);
        }

        let owed = principal * U256::from(cap_bps) / U256::from(BPS);
        let id = self.next_id.get_or_default();

        self.principal.set(&id, principal);
        self.owed.set(&id, owed);
        self.sweep_pct.set(&id, sweep_pct);
        self.merchant.set(&id, merchant);
        self.status.set(&id, Status::Active);
        self.next_id.set(id + 1);

        // Disburse principal to the merchant (this decreases the pool balance).
        self.asset_ref().transfer(&merchant, &principal);

        self.env().emit_event(AdvanceOpened {
            id,
            merchant,
            principal,
            owed,
            sweep_pct,
        });
        id
    }

    /// Repay against an advance. Anyone may call (typically the merchant or the
    /// RunwayReceiver forwarder routing `sweep_pct` of an incoming payment here).
    /// Only `min(amount, owed)` is actually pulled — never more than remains owed —
    /// so overpayment cannot occur. Caller must have approved this contract first.
    pub fn repay(&mut self, advance_id: u64, amount: U256) {
        self.assert_exists(advance_id);
        if self.status.get(&advance_id).unwrap_or(Status::Defaulted) != Status::Active {
            self.env().revert(Error::NotActive);
        }
        self.require_positive(amount);

        let owed = self.owed.get(&advance_id).unwrap_or_default();
        let pay = if amount < owed { amount } else { owed };

        let from = self.env().caller();
        self.asset_ref().transfer_from(&from, &self.env().self_address(), &pay);

        let remaining = owed - pay;
        self.owed.set(&advance_id, remaining);
        // Repaid tokens return to the contract, restoring pool capital automatically.

        self.env().emit_event(AdvanceRepaid {
            id: advance_id,
            amount: pay,
            remaining,
        });

        if remaining.is_zero() {
            self.status.set(&advance_id, Status::Repaid);
            self.env().emit_event(AdvanceClosed {
                id: advance_id,
                status: Status::Repaid,
            });
        }
    }

    /// Mark an advance defaulted. Owner or policy signer only.
    pub fn mark_default(&mut self, advance_id: u64) {
        self.assert_owner_or_policy();
        self.assert_exists(advance_id);
        self.status.set(&advance_id, Status::Defaulted);
        self.env().emit_event(AdvanceClosed {
            id: advance_id,
            status: Status::Defaulted,
        });
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    pub fn get_advance(&self, advance_id: u64) -> AdvanceView {
        self.assert_exists(advance_id);
        AdvanceView {
            id: advance_id,
            merchant: self.merchant.get(&advance_id).unwrap_or_revert(&self.env()),
            principal: self.principal.get(&advance_id).unwrap_or_default(),
            owed: self.owed.get(&advance_id).unwrap_or_default(),
            sweep_pct: self.sweep_pct.get(&advance_id).unwrap_or_default(),
            status: self.status.get(&advance_id).unwrap_or(Status::Defaulted),
        }
    }

    pub fn get_pool_balance(&self) -> U256 {
        self.pool()
    }

    pub fn get_owed(&self, advance_id: u64) -> U256 {
        self.owed.get(&advance_id).unwrap_or_default()
    }

    pub fn get_policy_signer(&self) -> Address {
        self.policy_signer.get_or_revert_with(Error::NotPolicySigner)
    }

    pub fn get_asset(&self) -> Address {
        self.asset.get_or_revert_with(Error::UnknownAdvance)
    }

    pub fn advance_count(&self) -> u64 {
        self.next_id.get_or_default()
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Available pool capital = this contract's live CEP-18 balance.
    fn pool(&self) -> U256 {
        self.asset_ref().balance_of(&self.env().self_address())
    }

    fn asset_ref(&self) -> Cep18ContractRef {
        Cep18ContractRef::new(self.env(), self.asset.get_or_revert_with(Error::UnknownAdvance))
    }

    fn require_positive(&self, amount: U256) {
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
    }

    fn assert_exists(&self, advance_id: u64) {
        if advance_id >= self.next_id.get_or_default() {
            self.env().revert(Error::UnknownAdvance);
        }
    }

    fn assert_policy_signer(&self) {
        let signer = self.policy_signer.get_or_revert_with(Error::NotPolicySigner);
        if self.env().caller() != signer {
            self.env().revert(Error::NotPolicySigner);
        }
    }

    fn assert_owner(&self) {
        let owner = self.owner.get_or_revert_with(Error::NotOwner);
        if self.env().caller() != owner {
            self.env().revert(Error::NotOwner);
        }
    }

    fn assert_owner_or_policy(&self) {
        let caller = self.env().caller();
        let owner = self.owner.get_or_revert_with(Error::NotOwner);
        let signer = self.policy_signer.get_or_revert_with(Error::NotPolicySigner);
        if caller != owner && caller != signer {
            self.env().revert(Error::NotOwner);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostEnv};
    use odra_modules::cep18_token::{Cep18, Cep18HostRef, Cep18InitArgs};

    const SUPPLY: u64 = 1_000_000_000;
    const POOL: u64 = 500_000_000;
    const PRINCIPAL: u64 = 100_000_000;
    const CAP_BPS: u32 = 11_500; // repay 115%
    const SWEEP_PCT: u32 = 1_000; // 10%

    struct Ctx {
        env: HostEnv,
        token: Cep18HostRef,
        runway: RunwayAdvanceHostRef,
        owner: Address,
        policy: Address,
        merchant: Address,
    }

    fn setup() -> Ctx {
        let env = odra_test::env();
        let owner = env.get_account(0); // holds the whole token supply
        let policy = env.get_account(1);
        let merchant = env.get_account(2);

        let token = Cep18::deploy(
            &env,
            Cep18InitArgs {
                symbol: "RUN".to_string(),
                name: "RunwayUSD".to_string(),
                decimals: 9,
                initial_supply: U256::from(SUPPLY),
            },
        );

        let runway = RunwayAdvance::deploy(
            &env,
            RunwayAdvanceInitArgs {
                owner,
                policy_signer: policy,
                asset: token.address(),
            },
        );

        Ctx { env, token, runway, owner, policy, merchant }
    }

    fn fund(ctx: &mut Ctx, amount: u64) {
        ctx.env.set_caller(ctx.owner);
        ctx.token.approve(&ctx.runway.address(), &U256::from(amount));
        ctx.runway.fund_pool(U256::from(amount));
    }

    #[test]
    fn full_lifecycle() {
        let mut ctx = setup();
        fund(&mut ctx, POOL);
        assert_eq!(ctx.runway.get_pool_balance(), U256::from(POOL));

        // Open — as the policy signer.
        ctx.env.set_caller(ctx.policy);
        let id = ctx
            .runway
            .open_advance(ctx.merchant, U256::from(PRINCIPAL), SWEEP_PCT, CAP_BPS);
        assert_eq!(id, 0);

        // Principal disbursed to merchant; owed = principal * 1.15; pool reduced.
        assert_eq!(ctx.token.balance_of(&ctx.merchant), U256::from(PRINCIPAL));
        let expected_owed = U256::from(PRINCIPAL) * U256::from(CAP_BPS) / U256::from(10_000u64);
        assert_eq!(ctx.runway.get_owed(id), expected_owed);
        assert_eq!(ctx.runway.get_pool_balance(), U256::from(POOL - PRINCIPAL));

        let view = ctx.runway.get_advance(id);
        assert_eq!(view.status, Status::Active);
        assert_eq!(view.sweep_pct, SWEEP_PCT);

        // Repay in two sweeps from the owner account (stands in for swept revenue).
        ctx.env.set_caller(ctx.owner);
        ctx.token.approve(&ctx.runway.address(), &U256::from(SUPPLY));

        ctx.runway.repay(id, U256::from(50_000_000u64));
        assert_eq!(ctx.runway.get_owed(id), expected_owed - U256::from(50_000_000u64));
        assert_eq!(ctx.runway.get_advance(id).status, Status::Active);

        // Overpay the remainder — only `owed` is pulled, never more.
        ctx.runway.repay(id, U256::from(999_000_000u64));
        assert_eq!(ctx.runway.get_owed(id), U256::zero());
        assert_eq!(ctx.runway.get_advance(id).status, Status::Repaid);
    }

    #[test]
    fn open_advance_rejects_non_policy_signer() {
        let mut ctx = setup();
        fund(&mut ctx, POOL);

        // Owner is NOT the policy signer — must be rejected.
        ctx.env.set_caller(ctx.owner);
        let err = ctx
            .runway
            .try_open_advance(ctx.merchant, U256::from(PRINCIPAL), SWEEP_PCT, CAP_BPS)
            .unwrap_err();
        assert_eq!(err, Error::NotPolicySigner.into());
    }

    #[test]
    fn open_advance_rejects_over_pool() {
        let mut ctx = setup();
        fund(&mut ctx, PRINCIPAL - 1); // pool just under the requested principal

        ctx.env.set_caller(ctx.policy);
        let err = ctx
            .runway
            .try_open_advance(ctx.merchant, U256::from(PRINCIPAL), SWEEP_PCT, CAP_BPS)
            .unwrap_err();
        assert_eq!(err, Error::InsufficientPool.into());
    }

    #[test]
    fn open_advance_rejects_bad_params() {
        let mut ctx = setup();
        fund(&mut ctx, POOL);
        ctx.env.set_caller(ctx.policy);

        // sweep_pct = 0 is invalid.
        assert_eq!(
            ctx.runway
                .try_open_advance(ctx.merchant, U256::from(PRINCIPAL), 0, CAP_BPS)
                .unwrap_err(),
            Error::InvalidSweepPct.into()
        );
        // cap below 100% is invalid.
        assert_eq!(
            ctx.runway
                .try_open_advance(ctx.merchant, U256::from(PRINCIPAL), SWEEP_PCT, 9_000)
                .unwrap_err(),
            Error::InvalidCap.into()
        );
    }
}
