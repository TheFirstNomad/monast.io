# Monast

**The global desk for everything — settled in USDC on Arc.**

[![Live on Arc Mainnet](https://img.shields.io/badge/Arc-Mainnet-blue?style=flat-square)](https://monast.io)
[![USDC Escrow](https://img.shields.io/badge/Settlement-USDC%20Escrow-green?style=flat-square)](https://monast.io/escrow-api)
[![Built on Arc](https://img.shields.io/badge/Chain-Arc-purple?style=flat-square)](https://arc.io)

Monast is the everything-marketplace powered by the Arc network. Crypto, NFTs, social accounts, domains, software, services — every trade settles in USDC escrow on Arc. No banks. No borders. No FX friction.

---

## What you can trade on Monast

| Category | Examples |
|---|---|
| Crypto & Tokens | BTC, ETH, BNB, SOL, STRK, USDC OTC trades |
| NFTs & Collectibles | CryptoPunks, BAYC, Azuki, Pudgy Penguins, Hyper NFTs |
| Social & Media Accounts | X, TikTok, Instagram, Facebook, Snapchat, YouTube |
| Domains & Handles | ENS names, .sns domains, web2 domains, social handles |
| Apps & Software | SaaS subscriptions, software licences, digital tools |
| Freelance Services | Design, development, writing, marketing |
| Digital Products | Figma files, Notion templates, courses, datasets |
| Physical Goods | Ships globally, settled in USDC |

---

## How it works

1. **Seller lists** — pays a 0.15 USDC listing fee to publish
2. **Buyer funds escrow** — USDC is locked in the smart contract on Arc
3. **Seller delivers** — transfers the asset or completes the service
4. **Buyer confirms** — escrow releases 97.5 USDC to seller, 2.5% fee to Monast treasury
5. **Dispute?** — arbitrator resolves; pull-payment pattern ensures funds are never locked

---

## Smart Contracts

### MonastEscrowV2 — Live on Arc Mainnet
The current production escrow contract.

| Property | Value |
|---|---|
| Address | `0xcA19dF99563fe93c6172463E4B66a3DCF2cf1eBA` |
| Chain | Arc Mainnet (Chain ID 5042) |
| Standard | Solidity 0.8.28, EVM Paris |
| Platform fee | 2.5% (250 bps) |
| Listing fee | 0.15 USDC |
| Auto-release | 72 hours after seller marks ready |
| Audit | 2 rounds, all findings fixed |

Key features: EIP-712 signed off-chain offers, listing fees, 72h auto-release, multi-quantity slots, spotlight fees, token rescue with accounting guard, `Ownable2Step`, `SafeERC20`, `ReentrancyGuard`.

### MonastEscrowV3 — Parked, Mainnet-ready
A production-grade upgrade written, audited, and tested — not yet deployed. Awaiting redeployment from the owner's wallet after independent third-party audit.

| Property | Value |
|---|---|
| Implementation | `0xa24d596a21c138693652616655010063b30dda3c` (Arc Testnet) |
| Upgradeability | UUPS proxy + 48h upgrade timelock |
| Roles | 5 separate roles (Admin, Pauser, Arbitrator, FeeManager, Rescuer) |
| Offer signing | EIP-712 with nonce + deadline (replay-proof) |
| Wallet support | ERC-1271 (Safe multisigs, Circle Modular Wallets) |
| Value flows | Full pull-payment pattern — zero push-transfer risk |
| Accounting | `totalEscrowed + totalPendingWithdrawals` guard on rescue |
| Test suite | 74/74 Foundry tests pass, invariant fuzzing (256 runs) |
| Slither | 0 Medium/High findings |
| Audits | 3 rounds max-severity + functional audit, all findings fixed |

---

## Platform Fees

| Fee | Amount | Destination |
|---|---|---|
| Escrow platform fee | 2.5% of sale | Treasury wallet |
| Listing fee | 0.15 USDC | Treasury wallet |
| Spotlight — 1 day | 0.50 USDC | Treasury wallet |
| Spotlight — 3 days | 1.00 USDC | Treasury wallet |
| Spotlight — 7 days | 2.00 USDC | Treasury wallet |
| Pro Seller subscription | 5.00 USDC/month | Treasury wallet |

---

## Features

### For buyers
- USDC escrow on every purchase — funds only release when you confirm delivery
- Dispute escalation to arbitrator at any time
- Payment protection 3-step indicator on every listing page
- Wallet connect (MetaMask, Rainbow, any EIP-1193 wallet) or Google Sign In

### For sellers
- 0.15 USDC listing fee — anti-spam, refunded if listing is cancelled before payment
- Edit, remove, or relist any listing at any time
- Mark as sold / ready for release
- Pro Seller badge (verified + pro\_until timestamp)
- Spotlight promotion — featured placement on browse and homepage
- Seller dashboard: listings, revenue, active escrows, wallet balance

### For AI agents
- **REST API** at `https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1/agent-api`
- **MCP server** at `https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1/mcp` (9 tools)
- Machine-readable terms at `/agents.txt`
- Per-agent API keys with daily spending caps
- Agents can browse listings, send offers, fund escrow, and message sellers
- OpenAPI 3.1 schema at `/api/openapi.json`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4 |
| Auth | Supabase Auth (Google OAuth, email OTP, wallet) |
| Database | Supabase Postgres (managed via Lovable) |
| Storage | Supabase Storage (listing images) |
| Realtime | Supabase Realtime (messages, offers) |
| Onchain | wagmi v2, viem, ConnectKit |
| Chain | Arc Mainnet (Chain ID 5042), USDC native gas |
| Contracts | Solidity 0.8.28, OpenZeppelin 5.1, Foundry |
| Edge Functions | Supabase Edge Functions (Deno) |
| Agent API | Express.js REST + MCP adapter |
| Deployment | Lovable (frontend + DB), GitHub (source) |

---

## Build Milestones

### Milestone 1 — Core marketplace (live)
- Listing creation with 0.15 USDC listing fee
- USDC escrow buy flow with confirmation and auto-release
- Messages and offers between buyers and sellers
- Google OAuth and wallet sign-in
- Mobile bottom nav
- Listing progress steps

### Milestone 2 — Monetisation + trust (live)
- Platform fee raised to 2.5% (250 bps)
- Pro Seller subscription page and badge system
- Verified seller badge
- Escrow trust badge on every listing
- Agent key issuer on agent docs page
- Supabase realtime messages subscription

### Milestone 3 — Ecosystem pages (live)
- Escrow API documentation page
- Reputation system page
- Agent billing page
- Buyer protection toggle on checkout
- For Freelancers, For Crypto Traders, For Domain Sellers landing pages

### Milestone 4 — Growth + SEO (live)
- Analytics dashboard
- Dispute history page
- Bulk import (50-row cap, validation limits)
- Dark/light theme toggle (light default)
- Share buttons on listing detail
- `sitemap.xml` (17 URLs) and `robots.txt`
- Price suggestion hook on post ad
- OG image, ItemList JSON-LD on browse

### Milestone 5 — UI overhaul + real category images (live)
- 12 expanded categories (Crypto, NFTs, Social, DeFi, Gaming, Domains, etc.)
- Real coin logos: BTC, ETH, BNB, SOL, USDC, STRK, ARB, MATIC, AVAX, OP (jsDelivr CDN, 250px)
- Real NFT art: CryptoPunks, BAYC, Azuki, Pudgy Penguins, Milady (OpenSea CDN)
- Real social icons: X, TikTok, Instagram, Facebook, Snapchat, YouTube, LinkedIn, Telegram (Wikimedia 1200px)
- Category cards redesigned as icon-row mosaics matching production preview
- Adaptive market shadow (light/dark mode aware)
- Colour-hashed user avatars (consistent per username, never a plain initial)
- Active route indicator in navbar
- Em-dash removal across all user-facing copy
- `SALE_FEE_BPS` corrected to 250 throughout

### Milestone 6 — Mainnet + audit fixes (live)
- "Live on Arc Testnet" status badge corrected to dynamic `ACTIVE_CHAIN.label` (now "Live on Arc Mainnet")
- Broken `/agent-docs` link fixed to `/escrow-api`
- Browse empty state with "List in this category" CTA
- Listing removal fixed for `pending_fee` listings (cancel at no charge)
- "List a similar item" button on removed listings with pre-filled form
- Raw text arrows replaced with icon components throughout
- Hero CTA updated to "List to sell"
- Navbar account dropdown with section separator

---

## Smart Contract Security

MonastEscrowV3 (parked, ready for mainnet) passed:
- 3 rounds of max-severity automated security review (solidity-auditor + functional-auditor in parallel)
- Slither static analysis (0 Medium/High findings; timestamp Low documented as acceptable)
- 74/74 Foundry unit tests including fuzz invariants
- All 7 findings from audit rounds 1-3 fixed before test run

Key security properties of V3:
- **No single point of failure**: 5 roles, each held by a separate key
- **No frozen funds**: pull-payment pattern on all value flows; `withdraw()` always callable
- **No replay attacks**: EIP-712 offers include nonce + deadline
- **No upgrade surprise**: 48h timelock on all upgrades, cancellable by admin
- **No rescue drain**: `rescuable = balance - totalEscrowed - totalPendingWithdrawals`
- **EIP-7201 namespaced storage**: upgrade-safe storage layout

---

## Development

```bash
# Install
bun install

# Dev server
bun run dev

# Typecheck
bun run check

# Smart contracts (requires Foundry)
forge build
forge test -vv
```

---

## Roadmap

- Deploy MonastEscrowV3 from owner wallet on Arc Mainnet after third-party audit
- Transfer V2 contract ownership to owner's Gnosis Safe multisig
- Agent selling endpoints (`POST /ads`, listing fee payment via agent API)
- Onchain reputation scores anchored to escrow completion history
- Arc Mainnet USDC bridge from other chains via CCTP
- Mobile app (React Native)

---

## License

MIT — see `LICENSE`.

---

*Built on [Arc](https://arc.io). Settled in [USDC](https://www.circle.com/usdc).*
