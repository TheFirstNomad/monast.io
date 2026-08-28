# Fix: Circle fee paid but listing stayed unpublished

## What actually happened (confirmed)

- The listing `a1d042e9…9999` is still `pending_fee`, with `listing_fee_tx_hash` and `listing_fee_paid_at` empty, so the backend never saw a payment.
- Circle's console shows the matching transfer as **Complete**: 0.15 USDC on Arc Testnet, from the user's Circle wallet to the revenue address, transaction `518ec78d-a61b-5c26-8c44-1774920a4a36`.
- Cause: the app only learns the Circle transaction id from the PIN-challenge result (`data.id`). For this transfer the challenge result came back without an id, so the client threw "Circle didn't return a transaction id", never polled for the tx hash, and never called the fee verifier. The money moved; the publish step was simply never triggered.

So the failure is a tracking gap, not a payment gap — and today there is no way to recover a payment once that gap happens.

## The fix

1. **Stop depending on the challenge result for the transaction id.** After the user approves the payment, resolve the transaction server-side by looking it up in Circle for that wallet: match the transfer by destination address, amount, and recency. Use the challenge-result id when it is present, and fall back to this lookup when it is not.
2. **Add a recovery path.** The publish page, on load and when a payment "fails" mid-flight, asks the backend whether a completed Circle transfer for this listing already exists. If one does, it verifies it on-chain and publishes the listing instead of asking the user to pay again.
3. **Make the double-pay guard explicit.** Because the transfer uses an idempotency key derived from purpose + listing id, retrying the same listing reuses the same Circle transfer rather than charging again; the recovery path relies on that and surfaces a clear message if a transfer is already complete.
4. **Recover this listing now.** Run the existing on-chain fee verifier against the confirmed transaction hash for that ad so it publishes.
5. **Apply the same recovery to escrow funding and promotions**, which share the identical Circle payment path and identical exposure.

## Technical notes

- `supabase/functions/circle-transfer/index.ts`: new `resolve` action that refreshes the Circle user session, lists `/user/transactions` for the user's wallet, and returns the transaction id / state / txHash for the transfer matching the purpose's expected destination and amount. Keeps the existing `status` action for id-based polling.
- `src/lib/payments/sendUsdc.ts`: after `runCircleChallenge`, use `data.id` if present, otherwise call `resolve`; poll by whichever identifier was obtained; only error out after resolve also finds nothing.
- `src/pages/PublishAd.tsx`: on mount for a `pending_fee` ad owned by a Circle-wallet user, call `resolve`; if a completed transfer with a txHash exists, invoke `ad-listing-fee` with it and publish. Same helper reused by `EscrowFundButton` / `Promote`.
- Sender binding in `ad-listing-fee` already accepts the Circle wallet address as `expectedFrom`, so the recovered hash verifies without loosening any security check.
- Tests: unit coverage for the resolve fallback (challenge without id, transfer found / not found / still pending) alongside the existing `functionErrors` tests.

## Scope

Only the Circle payment tracking, recovery, and publish flow change. No schema changes, no UI redesign, no change to on-chain verification rules.
