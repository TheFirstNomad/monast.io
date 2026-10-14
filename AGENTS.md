# Project Architecture Rules

- Render official Monast branding through the shared `BrandLogo` component so logo assets, sizing, and accessible labels remain consistent.
- Keep shared-link defaults in `siteMetadata`, with navigation fallbacks applied before page-specific SEO; mirror defaults in the static HTML head because social crawlers do not execute the app.
- Never change the live Circle App ID, Circle API key account, or user-wallet blockchain once users hold real funds; Circle wallets are tied to all three, so a switch gives users new empty wallets.
- Before repointing a profile to a different Circle wallet, archive the old address in `user_wallets` so no user wallet is ever lost.
