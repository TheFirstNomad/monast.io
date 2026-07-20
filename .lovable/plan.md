
# monast.io — Agentic Ecommerce with Circle Escrow

Goal: make onboarding effortless (email OTP → auto Circle multichain wallet, or connect self-custody wallet), keep one account that can hold multiple wallets, and execute every trade through Circle's Arc-native escrow primitive.

## 1. Auth — two doors, one identity

**Door A — Email OTP (default for new users)**
- Enable email OTP (magic code) sign-in.
- On first successful OTP, the backend calls Circle's User-Controlled Wallet API to:
  - Create a Circle `user` bound to the Supabase user id.
  - Issue a session token so the browser SDK can prompt the user to set a PIN + recovery.
  - Provision one multichain wallet (Arc + Base + Ethereum) under that user.
- The Circle wallet address is written to `profiles.circle_wallet_address` and also inserted into a new `user_wallets` table as the user's primary wallet.

**Door B — Self-custody wallet (existing SIWE flow, kept)**
- Reown AppKit connect → SIWE → Supabase session (already implemented).
- Wallet address inserted into `user_wallets` as an `external` wallet.

**One account, multiple wallets**
- Signed-in email users can later "Connect external wallet" from the dashboard: they sign a SIWE message that is verified against the current session and the address is linked to the same user in `user_wallets`.
- Signed-in SIWE users can later "Add email" to attach an email (and optionally provision a Circle wallet at that point too).
- A "Pay with" selector appears wherever the app spends funds (checkout, promote, offer), letting the user pick which linked wallet signs.

## 2. Circle wallet integration

- New Edge Functions:
  - `circle-user-provision` — called right after OTP verify; creates the Circle user, wallet set, and Arc/Base/ETH wallets; returns the session token + challenge for the browser to complete PIN setup.
  - `circle-wallet-sign` — server-side helper that builds Circle transaction challenges (escrow deposit, release, refund) and returns them to the browser SDK for the user to approve with their PIN.
- Browser: use Circle Web SDK (`@circle-fin/w3s-pw-web-sdk`) inside a `<CircleWalletProvider>` gated by the Supabase session. First-run flow: set PIN → confirm PIN → security questions.
- Existing `circle-proxy` function stays as-is for read-only stablecoin kit calls.
- Secret needed: `CIRCLE_API_KEY` (server) and `CIRCLE_APP_ID` (public, safe in code).

## 3. Circle Arc-native escrow

Circle publishes an escrow primitive as part of the Arc Stablecoin Kit. Plan will:
- Confirm the current Arc-native escrow endpoints via `circle-proxy` (`/v1/stablecoinKits/escrows` family) and lock the exact create / fund / release / refund / dispute paths before wiring UI.
- Store the escrow contract address per chain in `src/lib/escrow/addresses.ts`.
- New table `escrows` linking `ad_id`, `buyer_id`, `seller_id`, `circle_escrow_id`, `chain_id`, `amount_usdc`, `status` (`created | funded | released | refunded | disputed`), `tx_hashes` jsonb.
- New Edge Functions (`verify_jwt = false` where called by webhooks, otherwise default):
  - `escrow-create` — creates a Circle escrow for an accepted offer.
  - `escrow-fund` — verifies the on-chain USDC deposit tx and marks funded (reuses `_shared/tx-verify.ts`).
  - `escrow-release` — buyer confirms receipt; calls Circle release.
  - `escrow-refund` — seller cancels or admin refunds.
  - `escrow-webhook` — receives Circle status callbacks and updates the row.
- Replace the current `PayButton` "direct USDC transfer" path with an escrow deposit flow. Direct transfer stays only as a fallback for zero-value promo purchases.

## 4. UI changes (frontend only, no other business logic touched)

- `src/pages/Auth.tsx`: two tabs — "Continue with email" (OTP input) and "Connect wallet" (current button).
- New `src/components/EmailOtpForm.tsx` (request code → verify code → optional Circle PIN setup modal).
- New `src/components/CircleWalletSetup.tsx` (wraps Circle Web SDK challenges).
- Dashboard → new "Wallets" tab listing linked wallets, primary selector, "Add wallet" / "Add email".
- `AdDetail` checkout: replace direct pay with "Buy safely with escrow" → opens `EscrowCheckout` dialog (deposit into Circle escrow, then "Confirm delivery" / "Open dispute" states).
- Existing chat, offers, reviews, agents surfaces remain, but "Accept offer" now creates the escrow instead of just flipping status.

## 5. Agentic layer

- Extend `agent-api` and `mcp` with `escrow.create`, `escrow.fund`, `escrow.release`, `escrow.dispute` tools that call the same Edge Functions with the agent's owner as buyer.
- Update `/agents` and `/llms.txt` docs to describe the escrow-first flow so AI shoppers default to it.

## 6. Database migration (single migration, with GRANTs)

- `user_wallets` (user_id, address, kind `email_circle | external`, chain_id, is_primary, linked_at).
- `escrows` as described above with RLS: buyer or seller can select their own rows; only service_role can insert/update (all writes go through Edge Functions).
- Add `profiles.circle_user_id`, `profiles.circle_wallet_address`.

## 7. Secrets & config

- Add `CIRCLE_API_KEY` (server secret) — requested via secure form after plan approval.
- Add `CIRCLE_APP_ID` (public, put in `.env` as `VITE_CIRCLE_APP_ID`).
- Register `escrow-*` and `circle-user-provision` in `supabase/config.toml` where needed.

## 8. Out of scope for this plan

- Custom Solidity escrow (using Circle's primitive instead).
- Fiat on/off-ramp.
- Additional social login providers.
- Mobile-native app.

## Technical notes

- Circle User-Controlled Wallets use PIN + recovery; keys never leave the user's device, so the app custodies nothing.
- Multichain = one Circle wallet set produces addresses on Arc, Base, Ethereum; user picks chain at checkout.
- Escrow status is authoritative from Circle webhooks; the DB row is a cache and must reconcile on read.
- All escrow writes go through Edge Functions using service role; RLS on `escrows` blocks direct client writes.
- SIWE + email link uses the existing Supabase session as proof-of-ownership before inserting into `user_wallets`.

```text
Email OTP ─┐
           ├─► Supabase user ──► profiles + user_wallets
SIWE     ──┘                          │
                                      ▼
                     ┌── Circle User-Controlled Wallet (Arc/Base/ETH)
                     └── External self-custody wallet(s)
                                      │
                                      ▼
                          Circle Arc Escrow primitive
                     (create → fund → release / refund / dispute)
```
