# Hardening fixes — A1, C2, B2, C1 (B1 deferred)

Implements the handoff brief in the suggested order. All four items are confirmed against the current code.

## A1 — Correct USDC contract used for payouts (critical)

`supabase/functions/_shared/circle-dev.ts` currently sends Circle the token address `0x75faf…aa4d` for Arc Testnet, while the frontend chain registry and deposit verifier both use `0x3600000000000000000000000000000000000000`. This is the address used on every escrow release, refund, and fee sweep.

- Change the Arc Testnet USDC entry to `0x3600000000000000000000000000000000000000`.
- Add a comment naming `src/lib/chains.ts` / `_shared/tx-verify.ts` as the source of truth so the two can't drift again.

Note: this is a backend-only change; a real Release and Refund on Arc Testnet still need to be run manually afterwards to confirm funds land for the right recipient on `testnet.arcscan.app`.

## C2 — Honest listing-fee copy on Post Ad

`src/pages/PostAd.tsx` submit button says "Post Ad for Free" while the page charges the listing fee. Import `LISTING_FEE_USDC` from `src/lib/fees.ts` (already exported client-side) and label the button `Post Ad — 0.15 USDC` when the fee is above zero, falling back to "Post Ad for Free" when it's zero.

## B2 — Integer math in deposit verification

`supabase/functions/_shared/tx-verify.ts` converts the expected amount with float multiplication. Switch to `toBaseUnits` from `_shared/fees.ts`. Keep `USDC_DECIMALS` only if the display conversion still uses it (it does, on the returned `amountUsdc`).

## C1 — Sellers can remove a listing

`src/pages/AdDetail.tsx` only offers "Mark as Sold". Add a "Remove listing" action beside it, inside the existing owner-only branch:

- Re-check for open escrows (`created`, `funded`, `disputed`) at click time using the existing guard pattern; block with a clear message if one exists.
- On success set the ad's status to `removed` (already allowed by the table's check constraint and existing seller policies) and update local state.
- Add a `removed` state block above the existing `sold` block so visitors see "This listing has been removed" instead of the buy flow.

## Deferred

B1 (`siwe-verify` user lookup paging) stays untouched — that path is parked and hidden, and the brief recommends doing it when email/UCW login comes back.

## Verification

Run the existing test suite and confirm the Post Ad and Ad Detail pages render with the new copy and the new seller action.
