# Project Architecture Rules

- Render official Monast branding through the shared `BrandLogo` component so logo assets, sizing, and accessible labels remain consistent.
- Keep shared-link defaults in `siteMetadata`, with navigation fallbacks applied before page-specific SEO; mirror defaults in the static HTML head because social crawlers do not execute the app.
- Never change the live Circle App ID, Circle API key account, or user-wallet blockchain once users hold real funds; Circle wallets are tied to all three, so a switch gives users new empty wallets.
- Before repointing a profile to a different Circle wallet, archive the old address in `user_wallets` so no user wallet is ever lost.
- Owners delete listings only through the `owner_delete_ad` database function: it refuses while an escrow is open and archives (`deleted_by_owner`) instead of erasing listings with escrow or payment history, so trade records survive.
- Circle payment recovery must exclude transaction hashes already credited to another payment and transfers older than the reference; fees share amount and destination, so matching on those alone reuses old payments.
- New on-chain listings and their escrows settle in MonastEscrowV3 for both browser and Circle wallets; the server only mirrors contract events via `escrow-contract-sync`, and treasury transfers/payouts refuse contract listings and escrows so funds cannot take the wrong settlement path.
- Circle contract signing uses server-derived, simulated, allowlisted calldata and exact USDC approvals from the caller's existing ARC wallet; persist unique challenge requests and recover by challenge correlation IDs, never by transfer amount, to prevent duplicate charges and arbitrary contract execution.
- Circle contract API bodies use the persisted wallet ID alone, not the mutually exclusive blockchain/address selector; test this shared request builder to prevent provider validation failures across all escrow actions.
