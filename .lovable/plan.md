# monast.io: Arc-native cleanup + marketplace hardening

## Where the build actually stands (verified now)

- **Treasury is live.** Both Circle developer wallets exist and are active on Arc Testnet: escrow `0xc262…17a4` and revenue `0x064d…f837`. Payment paths are no longer blocked — listing fees, promotions, and escrow funding can now run end to end.
- **Marketplace has never been exercised.** The database holds 0 listings, 0 escrows, 0 promotions, and 2 profiles. So every flow is untested with real data, not broken-by-proof.
- **Moderation is inert.** The `user_roles` table has 0 rows, so the Disputes / Reports / Roles consoles are reachable by the owner wallet only and no moderator or arbitrator can act yet.
- **Trustless escrow contract does not exist** in the project. Escrow today is custodial through the Circle escrow wallet. That remains a separate Phase 2 workstream.
- **Multi-chain remnants are everywhere**, contradicting the "Arc native" goal (details in the technical section).

## What this build does

### 1. Make monast Arc-native (remove all other chains)

Arc Testnet (5042002) becomes the only supported network, with Arc Mainnet pre-wired as a disabled entry ready to flip on launch day.

- Wallet modal offers Arc only — no Base, Sepolia, or Tempo options.
- Chain registry reduced to Arc Testnet + Arc Mainnet (disabled).
- Server-side transaction verification accepts Arc chain IDs only, so a payment claimed on any other network is rejected instead of silently trusted.
- Circle blockchain mappings reduced to Arc.
- All user-facing copy that mentions Base or Tempo updated (homepage description, wallet setup dialog).
- Sign-in message stops claiming Chain ID 1 and states Arc.

### 2. Marketplace gaps and improvements

- **Empty-state polish**: Browse, Dashboard, Favorites, Messages, Transactions get clear "nothing here yet" states with a next action, instead of blank panels — the app is currently 100% empty data, so this is what every first visitor sees.
- **Seller journey completeness**: after posting, sellers land on the fee checkout with an explicit "your listing is hidden until the fee confirms" banner; the Dashboard shows a persistent "finish publishing" prompt per `pending_fee` listing.
- **Buyer journey**: escrow status timeline made explicit on the listing and escrow pages (created → funded → delivered → released), so buyers always know who acts next.
- **Link and route sweep**: audit every internal link, button, and navigation target across pages and footer; fix anything pointing at a non-existent route or a page that renders nothing useful. (Footer links already resolve to real routes; the sweep covers page-level buttons and admin entry points.)

### 3. Hardening

- Owner-only bootstrap action in the Roles console to grant the first moderator and arbitrator, so moderation stops being owner-only in practice.
- Every payment path refuses to submit when the treasury is missing or the wallet is on a non-Arc network, with a plain-language reason instead of a failed transaction.
- Consistent error surfacing on all edge-function calls (no raw 403/500 bodies shown to users).
- Re-run the security scan after changes and fix anything the chain reduction exposes.

### 4. Swap feature — decide after this

Once the marketplace is clean and Arc-native, I'll write a short follow-up plan for an AppKit-powered swap (no DEX contracts, no liquidity pools of our own) so users can top up USDC. Not built in this pass.

## Technical notes

Files carrying non-Arc chains today: `src/components/Web3Provider.tsx` (registers `base`, `sepolia`, Tempo mainnet + Moderato), `src/lib/chains.ts` (6-chain registry), `src/lib/arcAppKit.ts` (8453 branches), `src/lib/usdc.ts` (already Arc-derived), `supabase/functions/_shared/tx-verify.ts` (Base/Base-Sepolia/Arbitrum-Sepolia/Eth-Sepolia RPCs), `supabase/functions/_shared/circle-dev.ts` (Base/Eth-Sepolia maps), `supabase/functions/circle-escrow-fund/index.ts` (BASE-SEPOLIA, ETH-SEPOLIA), plus copy in `src/pages/Index.tsx` and `src/components/WalletSetupDialog.tsx`.

Tempo entries are already `enabled: false` with zero-address USDC; they get deleted rather than kept as dead config. No database migration is required for the chain reduction — existing rows all carry `chain_id` 5042002.

## Out of scope

Trustless Solidity escrow deployment, Arc Mainnet cutover, and the swap feature — each gets its own plan.
