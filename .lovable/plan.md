# Deep Audit & Fix Plan

## About the "blank preview"
I navigated to the preview from my side and the homepage renders correctly (header, green hero, categories, recent listings). The blank screen you're seeing is almost certainly a stale cached iframe from earlier — please hard‑refresh the preview (the circular refresh icon above it). If after that it's still blank, send me a screenshot and the browser console.

A real‑live screenshot is below for reference (your app is up):
- Header + "Buy & Sell Anything Worldwide with USDC on Arc" hero ✔
- Categories grid ✔
- Recent listings section ✔

---

## Critical bugs found

### 1. Wrong chain & wrong USDC contract in payment flow (BLOCKER)
`src/lib/usdc.ts` ships Arbitrum's chain id (`0xa4b1` = 42161) and Arbitrum's USDC address (`0xaf88…5831`), but the app and `src/lib/chains.ts` target **Arc Testnet (5042002)** with USDC `0x75fa…AA4d`. As written today, `PayButton` would silently route real funds to the wrong network and the wrong token contract. Fix: replace `usdc.ts` constants with values pulled from `chains.ts` (default to Arc Testnet for now, selectable per‑chain later).

### 2. Wallet hook bypasses Reown / wagmi
`src/hooks/useWallet.tsx` still uses raw `window.ethereum` + a hardcoded Arbitrum `ARC_PARAMS` block. The whole Phase‑1 infra port (Reown AppKit + wagmi + 5‑chain registry) is never used by the UI. The "Connect Wallet" button only works for MetaMask, ignores WalletConnect/Coinbase/etc., and tries to add Arbitrum to the wallet under the name "Arc". Fix: rewrite `useWallet` as a thin wrapper around wagmi (`useAccount`, `useConnect`, `useDisconnect`, `useSwitchChain`) and trigger the Reown modal via `useAppKit().open()`.

### 3. PayButton chain check uses the wrong id
Same root cause as #1 — once `usdc.ts` is fixed, `PayButton` must read the active chain from wagmi and dispatch via `useSendTransaction` / `useWriteContract` instead of `window.ethereum.request`. This also lets us support all 5 configured chains (Base, Arc, Sepolia, Tempo, Tempo Moderato).

### 4. Duplicate React‑Query providers
There's a `QueryClient` in `src/App.tsx` and another in `src/components/Web3Provider.tsx`. Nesting works but causes duplicate caches and dev‑tool confusion. Fix: keep the one in `Web3Provider` (wagmi needs it) and remove the one in `App.tsx`.

## Smaller bugs / UX gaps

5. **Navbar search input** has no `onChange`, no submit, no navigation — purely cosmetic. Wire it to `navigate('/browse?q=' + encoded)` on Enter.
6. **Mobile menu "Connect Wallet"** uses the same legacy hook; will be fixed by #2.
7. **`PostAd` image upload**: no size/type validation; a 50 MB HEIC will hang the upload. Add a 5 MB / `image/*` guard and per‑file error toast.
8. **`profiles.total_ads`** never increments. Add a trigger on `ads` (insert → +1, delete → −1 for that seller) so seller cards show real counts.
9. **`ReviewSection`** silently fails for users who haven't paid (because of the tightened RLS). Add a friendly "Only buyers who completed payment can review" empty state and hide the form for non‑buyers.
10. **`Auth.tsx`**: `emailRedirectTo` should point to `${window.location.origin}/dashboard` so users land somewhere useful after confirming.

## What I will NOT touch
- Schema / RLS (already cleaned by the security pass).
- The Tempo placeholder USDC addresses in `chains.ts` (still pending official deployment).
- Page layouts and design tokens.

## Files to change
- `src/lib/usdc.ts` — rewrite to use Arc Testnet defaults from `chains.ts`.
- `src/hooks/useWallet.tsx` — rewrite on top of wagmi + Reown AppKit.
- `src/components/PayButton.tsx` — switch to wagmi `useWriteContract` + active chain checks.
- `src/components/Navbar.tsx` — wire the search input.
- `src/pages/PostAd.tsx` — add upload validation.
- `src/pages/Auth.tsx` — fix `emailRedirectTo`.
- `src/components/ReviewSection.tsx` — gate the form behind a payment check.
- `src/App.tsx` — remove the duplicate QueryClient.
- New migration: trigger to maintain `profiles.total_ads`.

## Out of scope (will surface as follow‑ups, not done now)
- Full multichain selector in `PayButton` (Base / Sepolia / Tempo) — current pass only ensures the **Arc Testnet** path is correct.
- Saved/favorite ads, admin moderation, dispute flow.

Approve this plan and I'll implement it in one pass.