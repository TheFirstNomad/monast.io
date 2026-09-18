# Audit, speed pass, then the mainnet flip

## What the audit found (verified against the live project)

**Good news on the wallets.** Both live wallets already exist and are already recorded in your own database on the live network, matching what Circle Console shows:

- escrow wallet — `0x357b1be7719845dd47eb47fc0cfa73402053c426`
- revenue wallet — `0xd0d196f0164914bd52bec30e23d5eb1c2bc41186`

So the flip is a settings change, not new wallet work.

**The one thing still holding the flip back.** The switch that tells the backend "live network is now the default" is not set, so every new listing fee, escrow and payout still goes to the test network. The live USDC and Circle token settings also need to be re-checked, because older placeholder values were saved earlier in the project and saved values can't be read back.

**Speed problems found.**
1. Every screen in the app is loaded up front, even admin screens a normal visitor never opens. First visit downloads far more than it needs.
2. The nine category pictures plus the homepage picture are around 1 MB of photos shipped in the initial load, in an older image format, all loaded immediately.
3. Listing pages ask the database for every column, including long descriptions and all photo links, even in lists that only show a title, price and one thumbnail.
4. Some common lookups have no matching database index: active listings sorted by date, offers by listing and by buyer, messages by participant, and escrows by status (used by the background job every 15 minutes).
5. The Messages inbox downloads your entire message history to the browser and groups it there, instead of asking for just the latest message per conversation.
6. The orders and account screens refresh on a fixed timer even when the tab is in the background.

**Correctness / tightening found.**
7. Nothing in the app prevents someone paying on the test network for a listing whose fee was paid on the live network once both are live; the network a listing belongs to should be pinned and shown.
8. Two long-standing database notices remain and are safe: one internal table intentionally has no public access rules, and one system extension lives in the default schema. No change; documented only.

Existing test-network escrows (one still open) keep working on the test network throughout.

## The work

**Step 1 — Speed and stability pass (no money logic touched)**
- Load screens on demand so first paint only pulls what the page needs.
- Convert the category and homepage pictures to modern compressed formats, size them for the slots they fill, and load below-the-fold ones only when scrolled to.
- Ask the database only for the fields each list actually shows.
- Add the missing indexes listed above.
- Rebuild the Messages inbox to fetch one row per conversation.
- Pause background refreshing while a tab is hidden and resume on focus.

**Step 2 — Pre-flip money-path tightening**
- Pin and display the network for every listing, escrow and payment so live and test activity can never be mixed.
- Re-check that no live payment can proceed unless the live USDC contract, live Circle token and both live treasury wallets are all present; fail with a clear message otherwise.

**Step 3 — The flip**
- Re-save the live network settings with your canonical values, then turn the live network on as the default.
- Confirm all links point at `explorer.arc.io`, run the full test suite, redeploy the money functions.
- Show you a checklist of every setting in effect, then stop.

**Step 4 — Live smoke test (after you confirm the wallets are funded)**
- Publish a listing (fee), fund an escrow, release it, and confirm each step on `explorer.arc.io`.

## Technical notes

- Settings applied to the backend: `ARC_DEFAULT_CHAIN_ID=5042`, `ARC_MAINNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000`, `CIRCLE_USDC_TOKEN_ID_ARC_MAINNET=5677d668-490d-51d3-82c7-b2b8313df2f4`, `ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io`, `ARC_MAINNET_EXPLORER_URL=https://explorer.arc.io`, `CIRCLE_ARC_MAINNET_BLOCKCHAIN=ARC`. Non-secret config values, re-set in place; the three live Circle credentials already saved are untouched and never printed.
- Frontend already defaults to chain 5042, `rpc.mainnet.arc.io` and the `0x3600…` USDC contract in `src/lib/chains.ts`, so no browser-side secret or key changes are needed; the existing App ID and the user-controlled sign-in path stay exactly as they are.
- `isArcMainnetLive()` in `supabase/functions/_shared/arc-chains.ts` keeps requiring both the USDC contract and the Circle token id; `defaultArcChainId()` only returns 5042 when that check passes.
- Code splitting via `React.lazy` per route in `src/App.tsx` with a shared Suspense fallback; images through `vite-imagetools` variants with the homepage image preloaded.
- Indexes: `ads(status, created_at desc)`, `offers(ad_id)`, `offers(buyer_id)`, `messages(sender_id, created_at)`, `messages(recipient_id, created_at)`, `escrows(status)`.
- Chain pinning reads the active chain from the existing registry; no schema change beyond using the `chain_id` columns already present.

## Effort

Step 1: 3–4 credits. Step 2: 2 credits. Step 3: 1–2 credits. Step 4: 1 credit.
