use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{CompanyVestingAccount, ANCHOR_DISCRIMINATOR};

pub fn exec_create_company_vesting_account(
    ctx: Context<CreateCompanyVestingAccount>,
    company_name: String,
) -> Result<()> {
    ctx.accounts
        .vesting_account
        .set_inner(CompanyVestingAccount {
            owner: ctx.accounts.payer.key(),
            company_name,
            mint: ctx.accounts.mint.key(),
            treasury_token_account: ctx.accounts.treasury_token_account.key(),
            treasury_bump: ctx.bumps.treasury_token_account,
            bump: ctx.bumps.vesting_account,
        });
    Ok(())
}

#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct CreateCompanyVestingAccount<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
      init,
      payer = payer,
      space = ANCHOR_DISCRIMINATOR + CompanyVestingAccount::INIT_SPACE,
      seeds = [company_name.as_ref()],
      bump,
    )]
    pub vesting_account: Account<'info, CompanyVestingAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
      init,
      payer = payer,
      token::mint = mint,
      token::authority = treasury_token_account,
      seeds = [b"vesting_treasury", company_name.as_bytes()],
      bump
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, anchor_spl::token_interface::TokenInterface>,
}
