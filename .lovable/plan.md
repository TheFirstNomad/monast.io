## Goal

Port the proven Web3 / admin-auth / security infrastructure from the `usdc.directory` project (Directory Builder) into monast.io, **without** carrying over directory-specific schema or pages. Then propose a fresh marketplace schema designed for real-world goods (houses, cars, etc.) paid in USDC.

This is a large port. I'd recommend approving it in two phases so we can verify each phase works before the next.

---

## Phase 1 — Infrastructure port (copy from Directory Builder)

### 1a. Web3 layer
- Copy `src/polyfills.ts` and add the `import "./polyfills"` line at top of `src/main.tsx`.
- Create `src/components/Web3Provider.tsx` based on source project's version, with same minimal Reown AppKit config (`email/socials/swaps/send/receive/onramp/history: false`), dark theme, brand accent updated to monast.io tokens.
- Wrap `<App />` in `<Web3Provider>` inside `src/main.tsx`.
- Add deps: `@reown/appkit`, `@reown/appkit-adapter-wagmi`, `wagmi`, `viem`, `@wagmi/core`, `@wagmi/connectors`, `@tanstack/react-query` (already present), `ox`, `buffer`.
- Reuse the existing `VITE_WALLET_CONNECT_PROJECT_ID` fallback id from source.

### 1b. Networks — `src/lib/chains.ts`
Rewrite chain registry with these 5 networks (replacing the existing simplified `src/lib/usdc.ts` later):

| Key | Name | chainId | RPC | Native | USDC | Enabled |
|---|---|---|---|---|---|---|
| `base` | Base Mainnet | 8453 | mainnet.base.org | ETH | `0x8335…2913` | ✅ |
| `arc-testnet` | Arc Testnet | 5042002 | rpc.testnet.arc.network | USDC (18-dec) | `0x75fa…AA4d` | ✅ |
| `sepolia` | Ethereum Sepolia | 11155111 | publicnode | ETH | `0x1c7D…7238` | ✅ |
| `tempo-mainnet` | Tempo Mainnet | 4217 | https://rpc.tempo.xyz | USDC placeholder (18-dec) | TBD `0x000…` | ✅ |
| `tempo-moderato` | Tempo Moderato Testnet | 42431 | https://rpc.moderato.tempo.xyz | USDC placeholder | TBD `0x000…` | ✅ |

Explorer URLs for Tempo: I'll use `https://explorer.tempo.xyz` and `https://explorer.moderato.tempo.xyz` as best-guess placeholders (Tempo docs not in my context); flag both as `TODO: confirm` in code.

All five chains registered as custom Wagmi/AppKit chains in `Web3Provider.tsx` (Base + Sepolia from `@reown/appkit/networks`, the other three defined inline like Arc currently is).

### 1c. Circle Arc App Kit + swap libs
- Copy `src/lib/arcAppKit.ts` verbatim.
- Copy `src/lib/swap/{chains,contracts,tokens,useQuote,useSwap}.ts` verbatim.
- Copy edge function `supabase/functions/circle-proxy/` verbatim (will auto-deploy).

### 1d. Admin auth system
- Copy `src/lib/adminAuth.ts` verbatim (treasury wallet stays `0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c`).
- Copy `supabase/functions/_shared/admin-auth.ts` verbatim.
- Migration: create `admin_sig_nonces` table + scheduled cleanup function (port the source migration that defines them).

### 1e. Security baseline
- **CSP**: replace `index.html` `<head>` with strict CSP meta tag matching source's.
- **Rate limiting**: port the `rate_limits` table + helper SQL functions used by admin/agent functions.
- **RLS deny-all + public view pattern**: I'll apply this to monast.io's sensitive tables in Phase 2 (after the new schema lands), not retrofit to current `ads`/`profiles` yet.
- **SSRF allowlist helper**: extract the allowlist pattern from `check-deployment` into a small shared helper module used by future outbound-fetching edge functions (no function copied since `check-deployment` is directory-specific).

### 1f. NOT copied (explicit)
Pages (Index, AIAgents, MerchantDetail, Submit, etc.), `data/`, `partners.ts`, `basePayment.ts`, `multichainPayments.ts`, `builderCode.ts`, `web3.ts`, directory-specific edge functions (`admin-agents`, `admin-featured`, `admin-listings`, `admin-payments`, `agents-api`, `boost-listing`, `check-deployment`, `mcp`, `og-agent`, `sitemap`, `submit-*`, `upload-logo`), and any `partners`/`merchants` migrations.

### 1g. Reconcile with existing monast.io code
- `src/lib/usdc.ts` → kept temporarily for `PayButton.tsx`, but I'll refactor `PayButton` and `useWallet` to use Wagmi + `chains.ts` instead of `window.ethereum` directly. Remove `useWallet` custom hook (replaced by `useAccount` / `useConnect` from wagmi / AppKit modal).

---

## Phase 2 — Fresh marketplace schema + pages (proposal only, build in next plan)

After Phase 1 lands, propose a new schema along these lines (NOT building yet — for discussion):

```text
listings
  id, seller_id, title, description, category (house|car|electronics|other),
  price_usdc, currency_chain, location, images[], status (draft|active|in_escrow|sold|cancelled),
  spec (jsonb: bedrooms, mileage, year, etc.),
  created_at, updated_at

offers
  id, listing_id, buyer_id, amount_usdc, message, status (pending|accepted|rejected|expired),
  expires_at

escrows
  id, listing_id, buyer_id, seller_id, amount_usdc, chain_id, usdc_address,
  escrow_contract_address, deposit_tx, release_tx, refund_tx,
  state (created|funded|delivered|released|disputed|refunded), arbiter (admin wallet),
  created_at, funded_at, released_at

wallet_links
  user_id, wallet_address, chain_id, verified_at, signature

disputes
  id, escrow_id, opened_by, reason, evidence[], resolution, resolved_by, resolved_at
```

Pages: `/`, `/browse`, `/listing/:id`, `/sell`, `/dashboard` (seller), `/purchases` (buyer), `/escrow/:id`, `/admin`. The existing `ads/offers/payments/messages/reviews` tables will be migrated into the new `listings/offers/escrows/...` shape or kept side-by-side then deprecated — to be decided in the Phase 2 plan.

---

## What I need from you before building

1. **Approve Phase 1 as scoped above**, or trim it (e.g. "skip swap libs for now").
2. **Tempo confirmations**: confirm chainIds 4217 / 42431 and that I should use placeholder zero-address USDC contracts (like Arc mainnet) until official addresses ship. Also confirm explorer URLs or tell me to leave them as `TODO`.
3. **Existing data**: the current `ads` / `payments` / `reviews` tables — keep, migrate, or drop in Phase 2? (Default: keep, deprecate gradually.)

Reply "go phase 1" (with any tweaks) and I'll switch to build mode and execute. Phase 2 schema will come as a separate plan once Phase 1 is verified.
