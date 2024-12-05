use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{CompanyVestingAccount, CustomError, EmployeeVestingAccount};

use super::employee_vesting_account;

pub fn exec_claim_tokens(ctx: Context<ClaimTokens>, company_name: String) -> Result<()> {
    let employee_account = &mut ctx.accounts.employee_account;

    let now = Clock::get()?.unix_timestamp;

    // check cliff
    if employee_account.cliff > now {
        return Err(CustomError::CliffNotPast.into());
    }

    // check
    let time_since_start = now.saturating_sub(employee_account.start_time);
    let total_vesting_time = employee_account
        .end_time
        .saturating_sub(employee_account.start_time);

    let total_vested_amount = if now >= employee_account.end_time {
        employee_account.total_amount
    } else {
        employee_account
            .total_amount
            .checked_mul(time_since_start as u64)
            .get_or_insert(0)
            .checked_div(total_vesting_time as u64)
            .unwrap_or(0)
    };

    let available_amount = total_vested_amount.saturating_sub(employee_account.total_withdrawn);
    if available_amount == 0 {
        return Err(CustomError::Depleted.into());
    }

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.treasury_token_account.to_account_info(),
        to: ctx.accounts.employee_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.treasury_token_account.to_account_info(),
    };

    let seeds: &[&[&[u8]]] = &[&[
        b"vesting_treasury",
        &company_name.as_bytes()[..],
        &[ctx.accounts.vesting_account.treasury_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        seeds,
    );

    transfer_checked(cpi_ctx, available_amount, ctx.accounts.mint.decimals)?;

    // update account state
    employee_account.total_withdrawn += available_amount;

    // TODO - close vesting account

    Ok(())
}

#[derive(Accounts)]
#[instruction(company_name:String)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        seeds = [b"employee_vesting", beneficiary.key().as_ref(), vesting_account.key().as_ref()],
        bump = employee_account.bump,
        has_one = beneficiary,
        has_one = vesting_account
    )]
    pub employee_account: Account<'info, EmployeeVestingAccount>,

    #[account(
        mut,
        seeds = [company_name.as_bytes()],
        bump = vesting_account.bump,
        has_one = treasury_token_account,
        has_one = mint,
    )]
    pub vesting_account: Account<'info, CompanyVestingAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = mint,
        associated_token::authority = beneficiary,
        associated_token::token_program = token_program,
    )]
    pub employee_token_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
