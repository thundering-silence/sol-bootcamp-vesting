use anchor_lang::prelude::*;

use crate::{CompanyVestingAccount, CustomError, EmployeeVestingAccount, ANCHOR_DISCRIMINATOR};

pub fn exec_create_employee_vesting_account(
    ctx: Context<CreateEmployeeVestingAccount>,
    start_time: i64,
    end_time: i64,
    cliff: i64,
    total: u64,
) -> Result<()> {
    // check vesting time
    if end_time.saturating_sub(start_time) == 0 {
        return Err(CustomError::InvalidVestingTime.into());
    }
    // check cliff time
    if cliff.saturating_sub(start_time) == 0 {
        return Err(CustomError::InvalidCliffTime.into());
    }
    // check amount
    if total == 0 {
        return Err(CustomError::InvalidAmount.into());
    }

    ctx.accounts
        .employee_account
        .set_inner(EmployeeVestingAccount {
            beneficiary: ctx.accounts.beneficiary.key(),
            start_time,
            end_time,
            cliff,
            vesting_account: ctx.accounts.vesting_account.key(),
            total_amount: total,
            total_withdrawn: 0,
            bump: ctx.bumps.employee_account,
        });
    Ok(())
}

#[derive(Accounts)]
pub struct CreateEmployeeVestingAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub beneficiary: SystemAccount<'info>,

    #[account(
        has_one = owner,
    )]
    pub vesting_account: Account<'info, CompanyVestingAccount>,

    #[account(
        init,
        payer = owner,
        space = ANCHOR_DISCRIMINATOR + EmployeeVestingAccount::INIT_SPACE,
        seeds = [b"employee_vesting", beneficiary.key().as_ref(), vesting_account.key().as_ref()],
        bump,
    )]
    pub employee_account: Account<'info, EmployeeVestingAccount>,

    pub system_program: Program<'info, System>,
}
