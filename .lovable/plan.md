# Plan — Finish monast.io build

Remaining work to complete the marketplace, picking up from the last session.

## Scope this session (≈5 credits budget)

### 1. Complete Sale flow
- Add a "Mark as Sold" button on `AdDetail.tsx` visible only to the seller when `status === "active"`.
- Add a `sold_at` timestamp via migration on `ads` (nullable).
- Update `status` to `sold` and stamp `sold_at` when seller confirms (also auto-stamped on successful PayButton transfer).
- Show a "Sold" badge on `AdCard` and `AdDetail` when applicable.

### 2. Transaction history
- New page `src/pages/Transactions.tsx` accessible from Dashboard and Navbar user menu.
- Two tabs: **Purchases** (offers I made that were accepted, or ads I paid for) and **Sales** (my ads marked sold).
- Persist on-chain payment receipts: new `payments` table (ad_id, buyer_id, seller_id, amount_usdc, tx_hash, chain_id) — recorded by `PayButton` after a successful tx so receipts survive.
- Migration + RLS (buyer or seller can read their rows; only buyer can insert their own).

### 3. Seller profile page
- New route `/seller/:id` → `src/pages/SellerProfile.tsx`.
- Shows avatar, display name, member-since, rating (avg from `reviews`), total ads, active listings grid, and recent reviews.
- Link the seller card on `AdDetail.tsx` to this new page.

### 4. Wire-up
- Add Navbar link to Transactions when authenticated.
- Add link to Seller Profile from `AdCard` author area (if shown) and from `AdDetail` seller card.

## Technical notes

- Migration: `alter table ads add column sold_at timestamptz;` and create `payments` table with RLS.
- Reuse existing `useAuth`, `useWallet`, `supabase` client patterns.
- Keep all UI in semantic tokens (no raw colors).
- No new dependencies.

## Out of scope (later sessions)
- Saved/favorited ads
- Search filters polish, pagination
- Admin moderation, reporting
- Email notifications
- Escrow smart contract (currently direct USDC transfer)

## Credit estimate for full remaining build

Lovable build mode is usage-based — I can't give an exact number. Realistically, finishing everything above plus the "out of scope" polish typically lands in the **15–30 credits** range depending on iteration and bug-fix cycles. This session targets ~5 credits to deliver sections 1–4.
