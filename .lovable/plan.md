# Swap feature, new nav menu, and category cleanup

## 1. Real swap on Arc (replaces the "Connect Wallet" slot)

A new `/swap` page plus a compact swap widget, powered by Circle App Kit's `kit.swap` (already wired in `src/lib/arcAppKit.ts` and routed through the `circle-proxy` edge function, so no DEX contracts or liquidity pools of our own).

- Navbar: the "Connect Wallet" button position becomes a **Swap** button that opens the swap dialog (wallet connect moves into the new account dropdown, see section 3).
- Swap panel: token-in / token-out selectors, amount input, live wallet balance, quote/summary, and a single "Swap" action.
- If no wallet is connected, the Swap button first triggers wallet connect, then continues to the swap.
- Result state shows the tx hash as a clickable ArcScan link, and errors surface as toasts.
- Token list: Arc Testnet tokens supported by App Kit — USDC (native gas token) plus the other Arc test tokens App Kit exposes. We query App Kit for the supported token list rather than hardcoding a guess; if the list comes back with only USDC on testnet, the panel shows "more pairs at Arc mainnet launch" instead of a broken selector.

## 2. Categories

In `src/lib/types.ts`:
- Add **Crypto & NFTs**.
- Add **Apps** (for buying/selling apps).
- Merge Electronics into a single **Electronics & Phones** entry (laptop + phone imagery), dropping the separate "Phones & Tablets".
- Remove **Home & Garden**.

Category tiles get proper icon treatment in `CategoryGrid` (laptop+phone pair for Electronics, an app-grid mark for Apps, a coin/NFT mark for Crypto & NFTs) instead of plain emoji where a pair is needed.

Existing ads that still carry old category names ("Phones & Tablets", "Home & Garden") stay browsable: Browse maps legacy names onto the new set so no listing becomes unreachable.

## 3. Corner account dropdown (megapot.io-style)

One consolidated menu button in the top-right corner, always visible whether signed in or not — organized in labelled groups like the reference:

- **Signed out:** Connect wallet / Sign in with email, then Browse, Pricing, Agent API docs.
- **Signed in:** wallet address + short balance at the top, then groups:
  - Account — Dashboard, Profile settings, Saved items, Messages, Transactions
  - Build — Agents, Agent API docs
  - Admin — Treasury, Disputes, Reports, Roles (only for owner/moderator/arbitrator, unchanged permissions)
  - Sign out
- The separate favorites / messages / transactions / user icon buttons collapse into this menu so the bar reads: logo, search, Pricing, Swap, notifications bell, account menu, Post Free Ad.
- Mobile menu mirrors the same grouping.

## Technical notes

- Files touched: `src/components/Navbar.tsx`, new `src/components/SwapDialog.tsx` + `src/pages/Swap.tsx`, `src/App.tsx` (route), `src/lib/types.ts`, `src/components/CategoryGrid.tsx`, `src/pages/Browse.tsx` (legacy category aliasing).
- Swap uses `swapViaKit` with the connected EIP-1193 provider via `useAppKitProvider("eip155")` and `createViemAdapterFromWallet`; no new backend, no new secrets, no schema change.
- All colors/styles use existing semantic tokens — no new palette.
