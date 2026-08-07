# monast.io — Status Check and Path to Production

## Verified state (checked this turn)

- Fee settings are live in the database: listing fee 0.15 USDC, sale fee 100 bps (1%), delivery window 72h, cancel-response window 48h.
- Payouts are wired for real: `escrow-release` and `escrow-refund` both call `runPayout`, record the Circle transaction id, seller net and platform fee.
- `treasury_wallets` has **0 rows** — no escrow wallet and no revenue wallet exist on any chain.
- `CIRCLE_ENTITY_SECRET` is **not set** in backend secrets, so `circle-dev.ts` refuses every treasury operation. Treasury provisioning cannot succeed today.
- Live data: 2 profiles, 0 ads, 0 escrows, 0 ledger entries. Nothing has flowed through the money path yet.
- No `user_roles` table and no `reports` table exist — so no arbitrator role and no moderation queue.
- No admin edge function beyond treasury (`admin-*` functions: none). Disputes have no resolution endpoint.
- `pg_cron` / `pg_net` are not installed, and `auto_release_at` is only written by `escrow-cancel` — nothing ever fires the auto-release.
- Chain config: Tempo Mainnet and Tempo Moderato are `enabled: true` but carry a zero-address USDC token. Arc Mainnet is present and correctly disabled.
- The `src/lib/swap/*` module and `src/lib/mockData.ts` are imported by nothing.

## What is achieved

- Auth: email OTP with automatic Circle user-controlled wallet, plus self-custody wallet login via SIWE with real signature verification.
- Marketplace: post ad with photos, browse with filters/sort, ad detail, offers with DB-enforced status rules, realtime chat, favorites, reviews gated on real payments, seller profiles, notifications.
- Escrow lifecycle: create, fund with on-chain USDC verification, release with 1% fee split, refund, cancel state machine, dispute flag — all guarded by database triggers.
- Fees: listing-fee verifier gates ad publishing; sale fee deducted at release; ledger table ready.
- Admin: owner-only treasury console at `/admin/treasury` behind a wallet-signature check.
- Agent layer: API-key auth, rate limits, activity log, OpenAPI spec, MCP server, hardened JSON-LD.
- Security: RLS on every public table, 0 open scanner findings, clean database linter.

## Blocking items before real money

1. **No treasury exists.** The entity secret is missing and no wallets are provisioned, so every payment surface is correctly disabled. Nothing else can be tested end to end until this is done.
2. **Nothing has ever been tested with funds.** Zero escrows means the fund → release → refund path is untested against a real chain.
3. **Auto-release never fires.** The timer is stored but no scheduled job releases funded escrows after the delivery window, so a silent buyer freezes the seller's funds forever.
4. **Disputes are a dead end.** A dispute can be opened but there is no arbitrator role, no queue, and no resolve endpoint.
5. **Broken chains are selectable.** Tempo Mainnet and Tempo Moderato are enabled with a zero USDC address — picking them produces undefined behaviour.

## What to do now, in order

**Step 1 — Bring the treasury online (needed before anything else)**
- You register an Entity Secret in the Circle console and save the recovery file; the secret goes into backend secrets via the secure form.
- Provision escrow + revenue wallets on Arc Testnet from `/admin/treasury`, connected as the owner wallet.
- Verify the console shows both addresses, live balances and escrow liability.

**Step 2 — Rehearse the money path on Arc Testnet**
- Publish an ad paying the 0.15 USDC listing fee; confirm the ad only goes live after verification.
- Fund an escrow, release it, and check the seller receives 99% and the revenue wallet 1%, with ledger rows and tx hashes for both legs.
- Fund a second escrow and refund it; confirm 100% returns to the buyer with no fee.

**Step 3 — Close the lifecycle gaps**
- Scheduled auto-release job: enable scheduling, then a function that releases funded escrows past `auto_release_at` and unlocks buyer refunds when a seller ignores a cancellation past the response window.
- Arbitrator role via a `user_roles` table plus a `has_role` function, an admin dispute queue screen, and a resolve endpoint restricted to that role.

**Step 4 — Trust and safety**
- `reports` table, report buttons on ads and profiles, admin review screen with a takedown action.
- Per-escrow deposit cap for the first weeks so worst-case loss is bounded.

**Step 5 — Cleanup and polish**
- Disable the Tempo chain entries until their USDC addresses are published.
- Delete the unused swap module and mock data.
- Transactional email on offer, sale, escrow funded/released and dispute.
- Full-text search index with ranking and pagination on browse.

Phase 2 (on-chain trustless escrow contract) and the Sep 16 Arc Mainnet cutover stay as previously agreed and come after the above is proven on testnet.

## Technical notes

- `circle-dev.ts` expects `CIRCLE_ENTITY_SECRET` as a 32-byte hex string (64 hex chars) — the console gives exactly this.
- Auto-release needs `pg_cron` and `pg_net` enabled, then a scheduled call into a new `escrow-auto-release` function using the service role.
- Owner wallet is pinned to `0x13FA…4D7c` in `_shared/admin-auth.ts`; the treasury console rejects any other wallet, which is why a different connected wallet returned 403.
- Roles must live in a dedicated `user_roles` table read through a security-definer `has_role` function — never on `profiles`.

## Effort estimate

- Step 1–2 (treasury online, testnet rehearsal): 2–4 credits, mostly verification.
- Step 3 (auto-release job, arbitrator role, dispute queue): 6–8 credits.
- Step 4 (reports, moderation, deposit cap): 4–6 credits.
- Step 5 (chain cleanup, dead code, email, search): 6–9 credits.
