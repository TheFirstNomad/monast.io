# Permanent delete for listings, escrow lock, and the stuck relist

## What's happening now
- "Remove" only hides a listing. It stays on your dashboard marked "Removed", so you have 3 keycard.sns listings piling up there.
- One of them (the 3,500 USDC one made at 22:34) actually had its 0.15 USDC fee paid on the live network. The other two were never paid.
- Relisting an unpaid one sends you back to the publish page, and you report it gets stuck there. I haven't pinned down why yet, so step 4 starts by finding the cause.

## What you'll get

1. **Delete listing (permanent)**
   - A "Delete" button on each of your listings, on the dashboard and on the listing page, with a "This can't be undone" confirmation.
   - Deleting removes the listing completely, along with its photos, favourites, offers and chat messages about it. It disappears from the dashboard and the listing count.
   - This works for unpaid, live, removed and sold listings.
   - **Exception for records:** if a listing ever had a completed or refunded escrow, deleting it removes it from your dashboard and the market, but the escrow record is kept. Buyers and sellers keep their purchase history and the money trail.

2. **Funded escrow locks the listing**
   - While an escrow is waiting for payment, funded, or under dispute, the listing can't be deleted, removed, or have its name or price changed. The block is enforced on the server too, not just hidden in the page.
   - The Delete button shows as locked with "Escrow in progress" and a link to the escrow.
   - Description and photos can still be edited (same as today).

3. **Dashboard cleanup**
   - Removed listings get two clear actions: "Relist" and "Delete".
   - Unpaid listings get "Publish" and "Delete".

4. **Fix relisting getting stuck at publish**
   - First, reproduce it on one of your unpaid keycard listings and find the exact cause. Likely suspects: the automatic "we found your earlier fee" check picking up the wrong payment, or the publish page still treating the listing as removed.
   - Fix it so a relisted unpaid listing can be paid and goes live. A relisted paid listing goes live straight away with no new fee.

5. **Your 3 keycard listings:** once this is done you can delete the two unpaid duplicates and relist the paid one for free. I won't delete anything for you unless you ask.

## Technical details
- New DB function `owner_delete_ad(_ad_id)` (security definer). It checks `auth.uid() = seller_id`, refuses when there's an escrow in `created/funded/disputed`, and refuses moderator-removed ads. If no escrow or payment history exists, it hard-deletes the ad (cascades to messages/offers/favorites/promotions). Otherwise it sets a new `ads.deleted_by_owner boolean default false` and `status='removed'`.
- BEFORE DELETE trigger on `ads` blocks deletes while an escrow is open (protects the existing direct-delete policy too). Extend `prevent_listing_fee_tamper` so a change to `status='removed'` is blocked while an escrow is open.
- Dashboard and seller queries filter `deleted_by_owner = false`. Photo files under `ad-photos/{user_id}/` that belong to the deleted ad get removed from storage on the client after a successful delete.
- Existing `lock_ad_terms_during_escrow` trigger already locks title and price. I'll check it covers all three open states (it does: created/funded/disputed).
- Relist bug: debug `PublishAd.tsx` self-heal (`resolveCirclePayment("listing_fee", ad.id)`) and the `ad.status !== "pending_fee"` early return after relist, using Playwright and the function logs.
- Add a test for the rule "can't delete while an escrow is open, can delete otherwise".
