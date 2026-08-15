# Three fixes: sender binding, copy, and payout self-heal

## 1. Bind on-chain verification to the caller's own wallet (critical)

Today a payment proof is accepted if *anyone* sent the right amount to the right treasury wallet. That means a transaction hash from a stranger's transfer can be replayed by a different user. The transfer verifier already supports an optional expected sender, so each of the three money endpoints will look up the caller's wallet on file and pass it in:

- Deposit confirmation: bind the deposit to the buyer's wallet.
- Listing fee: bind the fee payment to the seller's wallet.
- Promotion checkout: bind the payment to the buyer's wallet.

If a user has no wallet on file yet, the check falls back to today's behaviour for that user only (no hard block), keeping onboarding unaffected.

## 2. Copy fix on Post an Ad

The subtitle claims posting is free while the form charges a small listing fee. It becomes "Reach buyers worldwide."

## 3. Self-heal escrows stuck after a successful payout

When money leaves the treasury, the payout is recorded first and the escrow's own status is updated in a second step. If that second step fails, the escrow is stranded: funds moved but it still reads as funded or disputed, and the existing automatic release/refund jobs deliberately skip those rows, so nothing recovers them.

A new recovery pass runs alongside the existing reconciliation on the 15-minute maintenance schedule. For each stranded escrow it reads the money trail to decide whether it was a release or a refund, then replays exactly what the normal path would have done: close the escrow, mark the item sold (release) or put it back on sale (refund), record the payment, and notify the right party. Escrows with no money trail yet are left for a later pass.

## Technical notes

- `escrow-confirm-funded`, `ad-listing-fee`, `promote-checkout`: add a `profiles.wallet_address` lookup with the service client, pass `expectedFrom` to `verifyUsdcTransfer` (parameter already supported in `_shared/tx-verify.ts`).
- `_shared/reconcile.ts`: add exported `finishStuckPayouts(admin)` selecting escrows with `payout_status IN ('sent','confirmed')` and `status IN ('funded','disputed')`, limited to the existing `BATCH`; kind is read from `ledger_entries` (`seller_payout` vs `buyer_refund`); needs a `notify` import.
- `escrow-maintenance/index.ts`: import and run `finishStuckPayouts` as step 4 inside its own try/catch, include `healed` in the JSON response.
- Redeploy the four edge functions; run the test suite.
