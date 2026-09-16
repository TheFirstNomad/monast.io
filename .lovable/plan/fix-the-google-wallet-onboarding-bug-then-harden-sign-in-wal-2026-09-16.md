# Fix the Google wallet onboarding bug, then harden sign-in, wallets and escrow

## What is actually wrong (verified in your data)

Google sign-in already creates the wallet automatically — that part still works. The problem is
how the app decides whether a wallet exists.

The new "Finish setting up your payment wallet" card only treats a wallet as usable when **two**
values are stored on the account: the wallet address *and* the Circle wallet reference. I checked
the live records:

- `showiste@gmail.com` has a wallet address (`0x8947…7ebe`) but the wallet reference is empty.
- The same is true in the second wallet table for that account.

So a person with a perfectly good wallet is told to set one up. Tapping the button then runs the
**old email/PIN setup path**, which is the wrong path for a Google account: Circle reports the user
as already initialised, there is no new step to show, and the dialog sits on "Preparing your
wallet…" forever — exactly the screenshot.

This is a regression introduced by the onboarding card added recently, not a Circle or Google
problem.

## Fix

1. **Trust the wallet address.** A saved wallet address means the wallet is ready; the missing
   reference is looked up from Circle in the background rather than blocking the person.
2. **Never show the old setup dialog to Google users.** Google accounts finish during sign-in. If
   anything is missing, the app silently re-syncs from Circle instead of asking the user to do
   something.
3. **Back-fill the missing references** for accounts that already have wallets, both on the account
   record and in the wallet list, and store them consistently from every path that creates a wallet
   so this cannot drift again.
4. **No more infinite spinner.** Every wallet step gets a timeout and a readable message, and the
   real reason from the server is shown instead of a blank error.
5. **Silent self-heal on the account and checkout pages:** if a wallet reference is missing when a
   payment is about to happen, the app fetches it first and continues, rather than showing an
   onboarding step.

## Then: focused audit of sign-in, wallets and escrow money paths

Reviewed and fixed in this round (anything found outside these areas gets reported, not changed):

- Google sign-in end to end, including returning after a slow consent screen and a re-used browser.
- Self-custody wallet sign-in, so the two methods cannot overwrite each other's account records.
- Wallet page: balance, receive, send/withdraw, activity — including stuck states and stale balances.
- Escrow funding and release for both wallet types, including double-submit protection.
- Consistency check across the accounts that already exist, so no live user is left in a half state.

## Mainnet readiness

You do not have the live credentials yet, so the switch stays off. I will:

- Verify the network switch is fully configuration-driven (no hardcoded test network anywhere in
  payments, escrow, payouts, or explorer links).
- List exactly what you must supply to go live, and what I flip when you have it.
- Leave the app running on the test network until then.

## Technical details

- `src/hooks/useCircleWallet.tsx`: readiness keyed on `circle_wallet_address`; `circle_wallet_id`
  becomes an async enrichment, with `user_wallets.circle_wallet_id` as a fallback source.
- `src/components/wallet/CircleOnboardingCard.tsx`: returns null for accounts that already have an
  address; no `WalletSetupDialog` for social-login accounts.
- New `resync` action on `circle-transfer` (or `circle-social`) that mints a user session from the
  stored Circle session and writes `circle_wallet_id` to `profiles` and `user_wallets`.
- `circle-provision-wallet` writes `circle_wallet_id` into `user_wallets` too (it currently only
  writes it to `profiles`).
- One-off data back-fill for the affected rows via Circle lookup.
- `WalletSetupDialog`: bounded provisioning attempt with an abort timeout and `getFunctionErrors`
  message surfacing.
- Escrow, agent API, admin treasury and listing-fee logic are not restructured in this round.
