use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct EmployeeVestingAccount {
    pub beneficiary: Pubkey,
    pub start_time: i64,
    pub end_time: i64,
    pub cliff: i64,
    pub vesting_account: Pubkey,
    pub total_amount: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
}
