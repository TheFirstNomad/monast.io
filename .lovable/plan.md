# Monast polish pass: reporting, escrow roles, copy, category art

## 1. Confirm the hardening plan is closed
Re-run the test suite and re-check the archived hardening plan items (payout idempotency, integer USDC math, confirmation depth, rate limits, sign-in paging) against the current code, then report anything that is not actually in place. No code changes unless a gap turns up.

## 2. Users can no longer report themselves
Right now the profile page always shows "Report seller", so a wallet viewing its own profile sees a report button (visible in the attached screenshot).
- Hide the report control on your own profile, and show a small "This is your profile" line with a link to the dashboard instead.
- Hide the report control on your own listing on the ad page as well.
- Reporting still works normally for every other user.

## 3. Buyer and seller escrow views stop looking identical
Both roles currently see the same "Item not as promised? Open a dispute" text and the same dispute button twice.
- Buyer view: "Item not as promised? Open a dispute".
- Seller view: "Buyer not cooperating? Open a dispute" — the seller never claims the item was misdescribed.
- Remove the duplicate dispute button (keep one per view, in the actions area).
- Make the "Delivery & communication" paragraph role-aware: the seller is told to post proof of shipment/handover, the buyer is told to check the proof before releasing.
- Add a short role banner at the top ("You are the buyer — you release the funds" / "You are the seller — you get paid on release") so the two screens read differently at a glance.

## 4. Copy and typo sweep
Read every page and dialog and fix wording that reads machine-written or is inconsistent: placeholder-ish sentences, duplicated phrasing, mixed casing of MONAST / monast.io, "Loading..." states, capitalisation of Arc / USDC / escrow, and any leftover text from the removed swap and email sign-in flows. Keep it plain and specific; no marketing filler.

## 5. Higher-quality category artwork
Replace the emoji-only category tiles with generated icon images (crisp, dark-theme friendly, one visual style across all ten): Vehicles, Property, Electronics & Phones, Fashion, Crypto & NFTs, Apps, Services, Jobs, Agriculture, Others. Emoji stay as the fallback if an image fails to load. Tiles keep their current size and hover behaviour.

## Technical notes
- `src/pages/SellerProfile.tsx`: read the session with `useAuth`, gate `ReportDialog` on `user?.id !== profile.id`; same gate for `targetType="ad"` in `src/pages/AdDetail.tsx` against `ad.seller_id`.
- `src/pages/EscrowDetail.tsx`: role-branch the dispute label and the delivery paragraph off the existing `isBuyer` / `isSeller` flags; drop the second `canDispute` button.
- Category art: images generated into `src/assets`, uploaded as CDN asset pointers, referenced from `src/lib/types.ts` (`categories` gains an `image` field) and rendered in `src/components/CategoryGrid.tsx`. `PostAd`, `EditAd` and `Browse` keep using `name` only, so their filters are untouched.
- No database, escrow, or payout logic changes in this pass.
