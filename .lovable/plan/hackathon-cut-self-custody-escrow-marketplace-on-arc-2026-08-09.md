# Hackathon Cut: Self-Custody Escrow Marketplace on Arc

Goal: one clean, demo-safe path — connect a self-custody wallet, post a listing, pay the listing fee, buy with escrow, deliver, release. Everything not on that path is removed from the interface (code kept for later).

## What stays

- Self-custody wallet sign-in (wallet signature creates the account session)
- Post ad with photos, 0.15 USDC listing fee, listing goes live after on-chain verification
- Offers, chat, favourites, reviews, dashboard, transactions, notifications
- Full escrow: fund → held → mark delivered → release / refund / cancel / dispute
- Backend treasury + revenue wallets and the Circle payout engine (unchanged)
- Admin: Treasury, Disputes, Reports, Roles
- Agent API / MCP / agent docs
- Promotions / featured listings

## What gets hidden (code preserved, nothing deleted)

- Swap: Swap button in the navbar, the swap dialog, and the `/swap` page
- Email / one-time-code sign-in (this is what showed the unbranded confirmation email)
- Circle user-controlled wallet creation, PIN setup, the Circle "fund with balance" button, and the Circle-wallet escrow funding path

Any link to a hidden feature is removed from the navbar, footer, dashboard, and sign-in screen so nothing dead is reachable.

## The demo path, made reliable

1. **Sign in** — `/auth` becomes a single clear wallet screen: Connect wallet → sign the message → signed in. No email tab, no Circle branding.
2. **Post a listing** — after posting, the seller lands on the publish screen with wallet already connected; paying the fee switches to Arc Testnet automatically and the ad flips live once verified on-chain.
3. **Buy with escrow** — one Escrow button: creates the escrow, sends USDC to the escrow treasury from the buyer's own wallet, waits for confirmations, then shows "Held in escrow". The Circle-wallet alternative is gone, so there's only one branch to fail.
4. **Release** — seller marks delivered, buyer releases; the payout goes from the treasury to the seller's **self-custody** address, with the 1% platform fee split to the revenue wallet.
5. **Dispute / refund / auto-release** — unchanged, reachable from the escrow page.

## Technical notes

- Seller payout resolution in `_shared/payout.ts` currently prefers `profiles.circle_wallet_address` over the self-custody address. It will be reordered to prefer the linked self-custody wallet (`user_wallets` primary, then `profiles.wallet_address`), with Circle kept last as a fallback. SIWE already mirrors the signing address onto the profile, so every wallet-only seller has a payout target.
- `EscrowButton` loses its Circle-wallet branch and its Circle wallet lookup; it becomes a single wagmi USDC transfer to the escrow treasury plus `escrow-confirm-funded`, including the 202 "still confirming" polling state.
- `SignInChoice` is reduced to the wallet path; `WalletSetupDialog`, `CircleFundButton`, `SwapPanel`, `SwapDialog`, `Swap` page, `src/lib/circle/*`, `src/lib/arcAppKit.ts`, and `src/lib/swapTokens.ts` stay on disk, unimported.
- `/swap` route removed from `App.tsx`; Circle and swap edge functions (`circle-*`) stay deployed but unused.
- No database migration needed. No secrets change.
- A guard test asserts the removed surfaces are not reachable, plus a browser pass over home → auth → post ad → publish → ad detail → escrow to confirm each screen renders and the buttons wire up.
