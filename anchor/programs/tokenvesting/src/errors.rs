use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Claim not available yet")]
    CliffNotPast,
    
    #[msg("Vault depleted")]
    Depleted,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Invalid cliff time")]
    InvalidCliffTime,

    #[msg("Invalid vesting time")]
    InvalidVestingTime,
}
