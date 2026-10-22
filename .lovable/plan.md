# Fix "Fund escrow" failing on contract listings

## What actually went wrong
- The approval step already works: your wallet approved exactly 1 USDC to the escrow contract (confirmed on Arc).
- But the contract has this listing (termixai.eth) recorded at **1,400 USDC**, while Monast shows **1 USDC**. The price was edited in Monast after the listing was published to the contract, and the contract has no way to change a price.
- So the contract tried to pull 1,400 USDC with only 1 USDC approved: "transfer amount exceeds allowance". No money moved.
- The Arc Studio bot's `fundEscrowWithOffer` step does not exist on your deployed contract (only `fundEscrow`), so we keep the current approve-then-fund order, which is already correct.

## Fixes
1. **Contract price is the truth when paying.** Before asking for approval, the checkout reads the price from the contract. If it differs from the price shown, the button is disabled with a clear message instead of sending a failing transaction.
2. **Block price edits on contract listings.** The edit page locks the price for listings already on the contract, explaining the seller must delete and relist to change it.
3. **Fix this listing.** Offer to set termixai.eth back to its on-chain price, or the seller deletes and relists at 1 USDC (needs the 0.15 USDC fee). You choose.
4. Correct the sample in the agent docs so it no longer mentions `fundEscrowWithOffer`.
5. Add a small test: mismatched contract price blocks funding.

## Technical details
- `EscrowFundButton`: `getListing(onchain_listing_id)` via public client; compare `priceUsdc` to `toUsdcUnits(escrow.amount_usdc)`; approve exactly `priceUsdc`.
- `EditAd`: disable price input when `onchain_listing_id` is set; add a DB trigger rejecting `price_usdc` changes when `onchain_listing_id IS NOT NULL` (user sessions only).
- Escrow row 7f4ecf4f is still `created` and unfunded, safe to cancel or leave.
