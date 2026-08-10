# Hackathon submission fixes (4 items)

## 1. Auth / wallet sync (highest priority)

Today the wallet provider does auto-sign-in when a wallet connects, but protected pages
check only `user` + `loading` from the auth hook. While the wallet is connected and the
signature/session step is still in flight, those pages see "no user" and immediately push
the visitor to the sign-in page — which is why an already-connected wallet still gets asked
to connect again.

Changes:
- Add a single "auth is still settling" signal that combines: auth session loading, a
  connected wallet with no session yet, and the in-flight sign-in step.
- Route guards on `/post-ad`, `/dashboard`, `/messages`, `/transactions`, `/favorites`,
  `/settings`, `/promote`, `/publish`, `/escrow/:id` wait for that signal to clear before
  redirecting, and render a centered loading state instead of flashing the sign-in page.
- If a wallet is connected but no session exists, trigger the signature flow automatically
  once (no extra click), with a clear "Confirm the signature in your wallet" state.
- Keep the top-right wallet button reading from the same state so the header and page
  content never disagree.

## 2. Messages — real chat threads

- Add a thread view at `/messages/:adId/:otherId` that loads the full history for that ad
  between the two users, sends replies, and updates live.
- Conversation rows link to the thread instead of the ad page.
- Thread header has a back link to the conversation list plus a link to the listing.
- Reuse the existing chat logic (same query, realtime subscription and send path) so
  behaviour matches the in-page chat dialog.

## 3. Protect "Mark as Sold"

- On the listing page, load whether any escrow for that ad is `created`, `funded`, or
  `disputed`.
- If one exists, disable "Mark as Sold" and show: "Cannot mark as sold while an active
  escrow exists" with a link to the escrow.
- Re-check at click time so a stale page can't slip through.

## 4. Correct block explorer

- Transactions page currently links to Arbiscan. Switch to the Arc explorer via the
  existing explorer helper (Arc Testnet -> `https://testnet.arcscan.app/tx/...`), keyed off
  each payment's `chain_id`.

## Technical notes

- Files touched: `src/hooks/useWallet.tsx`, `src/hooks/useAuth.tsx` (or a small shared
  guard hook), the protected pages listed above, `src/pages/Messages.tsx` plus a new thread
  page, `src/App.tsx` (one new route), `src/pages/AdDetail.tsx`, `src/pages/Transactions.tsx`.
- No database migrations and no changes to escrow, payout, or fee logic.
- Verification: run the existing test suite and click through connect -> post ad ->
  message thread -> escrow -> transactions in the preview before handing back.
