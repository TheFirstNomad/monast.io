# Monast wallet experience for Google (Circle) users

## What I confirmed in the code today

- `supabase/functions/circle-transfer/index.ts` only accepts three purposes (`escrow_fund`, `listing_fee`, `promote_checkout`) plus `status` / `resolve`. There is no action that sends USDC to a user-chosen address, so a Google-signed user currently has **no way to withdraw** from their Circle wallet.
- No balance read exists anywhere in `src` (searched the whole folder). `WalletNetworkCard.tsx` shows a "Your balance" row that is only an ArcScan link, and for Circle wallets it renders a read-only address card with no actions.
- `getFreshUserSession()` calls Circle `/users/token/refresh` on **every** request (create, status poll, resolve). A status poll loop therefore hits Circle twice per tick, which is the main reason Circle flows feel slow.
- `CircleFundButton.tsx` polls `circle-tx-status` while `src/lib/payments/sendUsdc.ts` polls `circle-transfer` `status` - two divergent Circle paths for the same job.
- There is no `/wallet` route; wallet info is buried at the bottom of `/settings`.

## What I will build

### 1. Wallet backend (`circle-transfer` extended)

New actions, all scoped to the caller's own Circle wallet:

- `balance` - reads Circle wallet balances, returns USDC amount + token/chain info.
- `activity` - recent inbound/outbound transfers (id, direction, counterparty, amount, state, txHash, date).
- `withdraw` - validated: destination must match `^0x[0-9a-fA-F]{40}$`, amount positive, amount <= balance, self-send blocked. Returns a Circle challenge for the SDK, same shape as the existing payment flow.
- `withdrawStatus` - reuses the existing status lookup so the UI can follow the transfer to a txHash.

Hardening carried over from the existing code: per-user rate limit on withdraw, integer micro-USDC amount formatting (`toBaseUnits` + `formatUsdc`), `feeLevel: "MEDIUM"`, and a derived idempotency key per withdrawal request id so a double-click cannot send twice.

### 2. Session caching (the speed fix)

Cache the Circle `userToken` with its expiry in `circle_sessions` and only call `/users/token/refresh` when it is close to expiring. Balance reads, status polls and activity lists then cost one Circle call instead of two. Needs one small migration adding a token-expiry column.

### 3. New `/wallet` page

A single wallet home for both wallet types:

- Balance card: live USDC balance, Arc network badge, refresh button, skeleton loading (no blank screens).
- Receive: full address, copy button, QR code, plain-English "send USDC on Arc only" note.
- Send / withdraw: address + amount fields, "max" button, fee note, review step, Circle overlay, then progress states through to the ArcScan link.
- Recent activity list with ArcScan links.
- Self-custody users see the same layout, with sending handled by their own wallet as today.

`/wallet` is linked from the Navbar wallet menu and from the Dashboard; `/settings` keeps a compact summary that links across.

### 4. Faster perceived UI for social users

- Skeletons instead of full-page spinners on Dashboard and Wallet so signed-in users see structure immediately.
- Balance and activity fetched in parallel, cached in React Query with background refresh.
- Optimistic status text during a withdrawal instead of a frozen button.

### 5. Bug fixes found in the audit

- Collapse `CircleFundButton` onto the same `sendUsdcPayment` path so there is one Circle payment code path instead of two.
- Surface real backend messages via the existing `getFunctionErrors` helper on every new wallet call (no more bare "non-2xx").
- Replace the misleading "Your balance" explorer-URL row in `WalletNetworkCard` with the real number.

## Out of scope

Escrow logic, listing fees, promotions, SIWE self-custody sign-in, admin treasury, and the agent API stay untouched. No new chains - Arc Testnet only.
