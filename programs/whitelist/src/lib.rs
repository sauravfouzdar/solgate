use anchor_lang::prelude::*;

declare_id!("AwYg8PstkmQKpYhXFFhLb7x2JVv4my7ufetX4any3xtT");

#[program]
pub mod whitelist {
    use super::*;

    pub fn create_whitelist(ctx: Context<CreateWhitelist>) -> Result<()> {
        let record = &mut ctx.accounts.whitelist_config;
        record.authority = ctx.accounts.authority.key();
        record.counter = 0;
        Ok(())
    }

    pub fn add_wallet(ctx: Context<AddWallet>, _wallet_address: Pubkey) -> Result<()> {
        let record = &mut ctx.accounts.whitelist_config;
        record.counter = record.counter.checked_add(1).unwrap();
        Ok(())
    }

    pub fn check_wallet(_ctx: Context<CheckWallet>, _wallet_address: Pubkey) -> Result<()> {
        Ok(())
    }

    pub fn remove_wallet(ctx: Context<RemoveWallet>, _wallet_address: Pubkey) -> Result<()> {
        let record = &mut ctx.accounts.whitelist_config;
       record.counter =record.counter.checked_sub(1).unwrap();
        Ok(())
    }

    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        let record = &mut ctx.accounts.whitelist_config;
       record.authority = new_authority;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateWhitelist<'info> {
    #[account(mut)]
    authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = WhitelistConfig::LEN,
    )]
    whitelist_config: Account<'info, WhitelistConfig>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet_address: Pubkey)]
pub struct AddWallet<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    whitelist_config: Account<'info, WhitelistConfig>,
    #[account(
        init,
        seeds = [whitelist_config.key().as_ref(), wallet_address.as_ref()],
        bump,
        payer = fee_payer,
        space = 8,
    )]
    wallet_pda: Account<'info, Wallet>,
    /// CHECK: We do not read/write from this account
    authority: AccountInfo<'info>,
    #[account(mut)]
    fee_payer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet_address: Pubkey)]
pub struct CheckWallet<'info> {
    #[account(has_one = authority)]
    whitelist_config: Account<'info, WhitelistConfig>,
    /// CHECK: We do not read/write from this account
    authority: AccountInfo<'info>,
    #[account(
        seeds = [whitelist_config.key().as_ref(), wallet_address.key().as_ref()],
        bump,
    )]
    wallet_pda: Account<'info, Wallet>,
}

#[derive(Accounts)]
#[instruction(wallet_address: Pubkey)]
pub struct RemoveWallet<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    whitelist_config: Account<'info, WhitelistConfig>,
    #[account(
        mut,
        seeds=[whitelist_config.key().as_ref(), wallet_address.as_ref()],
        bump,
        close = refund_wallet,
    )]
    wallet_pda: Account<'info, Wallet>,
    /// CHECK: We do not read or write from this account
    authority: AccountInfo<'info>,
    #[account(mut)]
    refund_wallet: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(
        mut,
        constraint = whitelist_config.authority == current_authority.key(),
    )]
    whitelist_config: Account<'info, WhitelistConfig>,
    current_authority: Signer<'info>,
}

#[account]
pub struct WhitelistConfig {
    pub authority: Pubkey,
    pub counter: u64,
}

impl WhitelistConfig {
    pub const LEN: usize = 8 + 32 + 8;
}

#[account]
pub struct Wallet {}