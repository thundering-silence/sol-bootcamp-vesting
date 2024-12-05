#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("AsjZ3kWAUSQRNt2pZVeJkywhZ6gpLpHZmJjduPmKZDZZ");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub use constants::*;
pub use errors::*;
pub use instructions::*;
pub use state::*;

#[program]
pub mod tokenvesting {
    use super::*;

    pub fn create_company_vesting_account(
        ctx: Context<CreateCompanyVestingAccount>,
        company_name: String,
    ) -> Result<()> {
        instructions::company_vesting_account::exec_create_company_vesting_account(
            ctx,
            company_name,
        )
    }

    pub fn create_employee_vesting_account(
        ctx: Context<CreateEmployeeVestingAccount>,
        start_time: i64,
        end_time: i64,
        cliff_time: i64,
        total: u64,
    ) -> Result<()> {
        instructions::employee_vesting_account::exec_create_employee_vesting_account(
            ctx, start_time, end_time, cliff_time, total,
        )
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>, company_name: String) -> Result<()> {
        instructions::claim_tokens::exec_claim_tokens(ctx, company_name)
    }
}
