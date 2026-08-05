# monast.io — Deep Audit and Path to Production

## Verified state (checked this turn)

- Security scanners: 0 findings across Supabase, agent, MCP, connector and supply-chain scans. Database linter: clean. Dependency audit: no high/critical CVEs.
- RLS: enabled on all 17 public tables with ownership-scoped policies; `payments`, `escrows`, `promotions`, `agent_activity` are server-write-only.
- Live data: 0 profiles, 0 ads, 0 escrows, 0 offers, 0 agents, 0 wallets. Only 3 test `payments` rows. Nothing real has ever flowed through the app.
- Backend: 18 edge functions deployed. Auth (email OTP + Circle wallet provisioning + SIWE wallet login) is genuinely wired end to end with real Circle and viem signature verification — no mocks.

## What works today

- Sign-in both ways: email OTP creating a Circle user-controlled wallet (PIN challenge via Circle Web SDK), and self-custody wallet login via SIWE with real signature verification.
- Marketplace core: post ad with photos, browse with filters/sort, ad detail, offers with status guards, realtime chat, favorites, reviews gated on real payments, seller profiles, notifications bell, profile settings.
- Escrow bookkeeping: create, fund (with real on-chain USDC transfer verification via RPC logs), release, refund, dispute — all as status transitions guarded by a DB trigger.
- Agent layer: API-key auth, rate limits, activity log, OpenAPI spec, MCP server, JSON-LD with a hardened sanitizer.
- Promotions: tier catalog, checkout function, promote page.

## Blocking problems (must fix before real money)

1. **Escrow funds go to the burn address.** `src/lib/escrow.ts` and `src/lib/promotionTiers.ts` both default the treasury to `0x...dEaD`, and no `ESCROW_TREASURY_ADDRESS` secret is set, so the edge-function fallback uses the same dead address. Every buyer deposit and every promotion payment would be permanently destroyed.
2. **No payout leg exists.** `escrow-release` and `escrow-refund` only flip a status row; their own comments defer the on-chain transfer to a "Session 4 payout job" that was never built. Sellers never receive funds and buyers never get refunds.
3. **No real escrow custody.** There is no escrow smart contract and no Circle-controlled contract wallet — custody is a single hot address, so the marketplace is fully trusted rather than escrowed.
4. **Disputes have no resolution path.** Either party can open a dispute; there is no arbitrator queue, no admin UI, and no resolve endpoint. Admin auth exists only as a signature scheme with no consuming surface.
5. **Broken chain entries are enabled.** `src/lib/chains.ts` ships Tempo Mainnet and Tempo Moderato with `0x000...0` USDC addresses and unconfirmed explorers, and Arc Mainnet is a placeholder object. A user selecting Tempo gets undefined behaviour.

## Gaps for an all-in-one marketplace

- No reporting or moderation: no report table, no abuse queue, no takedown path, no admin panel routes.
- No transactional email: only in-app notifications; no email on offer, sale, escrow funded/released, or dispute.
- Search is `ilike` over title/description with no index, no full-text ranking, no pagination — fine at 100 ads, not at 100k.
- No shipping/delivery tracking, no order confirmation window, no auto-release timer on funded escrow.
- No seller payout ledger or fee accounting; no listing fee and no platform take rate are modelled anywhere.
- Dead code: the entire `src/lib/swap/*` DEX module (411 lines) is imported by nothing and has no route; `src/lib/mockData.ts` is unreferenced.
- No analytics/observability on funnel or function failures.

## Recommended sequence

**Phase 1 — make money safe (highest priority)**
- Replace both treasury constants with a real Circle developer-controlled wallet, injected via a backend secret; fail loudly instead of defaulting to a dead address.
- Build the payout leg: an `escrow-payout` path that sends USDC from the treasury wallet to the seller on release and back to the buyer on refund, records the tx hash, and only then flips status.
- Add idempotency and retry on payouts, plus a reconciliation view of treasury balance vs. open escrow liability.

- Add the 0.15 USDC listing fee and the 1% release fee (see Fee model below).

**Phase 2 — trustless escrow and trust/safety**
- Replace custodial custody with an on-chain escrow contract so the platform never holds funds (see Custody below).
- Arbitrator role via a `user_roles` table and `has_role`, an admin dispute queue, and a resolve path restricted to that role.
- Reports/moderation table plus report buttons on ads and profiles, and an admin review screen.
- Auto-release timer on funded escrows and a delivery-confirmation window.

**Phase 3 — production polish**
- Transactional email for the key lifecycle events.
- Full-text search index with ranking and paginated browse.
- Disable or correct the Tempo/Arc-mainnet chain entries.
- Delete the dead swap module and mock data, or ship the DEX as a real route.
- Basic product analytics and a short privacy notice (emails are stored). No KYC/AML: the marketplace stays permissionless by design.

## Technical notes

- Treasury addresses are duplicated across `src/lib/escrow.ts`, `src/lib/promotionTiers.ts`, `supabase/functions/escrow-confirm-funded`, and `supabase/functions/circle-escrow-fund`; consolidate to one config read from a secret.
- USDC addresses and RPC URLs are duplicated in `src/lib/chains.ts`, `src/lib/swap/tokens.ts`, and `supabase/functions/_shared/tx-verify.ts` with differing casing — drift risk.
- `tx-verify.ts` validates the Transfer log and receipt status but does not require a confirmation depth; add one before mainnet.
- SIWE users get a deterministic `@wallet.monast.io` email; this is intentional but means wallet users cannot receive email notifications.

## Treasury and fund custody design

**Two separate wallets, never one.** A Circle developer-controlled wallet set with two wallets per chain:

```text
Escrow wallet     <- buyer deposits only
                  -> seller on release, buyer on refund
                  -> withdrawals disabled by design

Revenue wallet    <- commission split at release, promotion payments
                  -> owner withdrawals allowed
```

Each chain has its own address inside the same wallet set, managed from one screen.

**Setup path (browser only).** The owner generates an Entity Secret in the Circle Console and saves the recovery file, then pastes the secret into Lovable's secure secret form. A backend function creates the wallet set and wallets. No terminal or local environment is needed.

**Withdrawals.** An owner-only admin screen, guarded by the existing wallet-signature admin auth, triggers a Circle transfer from the revenue wallet to any address the owner enters. The escrow wallet has no withdrawal path.

**Separating revenue from user funds.** On release the payout splits: seller amount to the seller, platform fee to the revenue wallet. Every movement is written to a ledger table. The admin dashboard shows escrow liability (sum of funded escrows) against the escrow wallet's on-chain balance, plus available revenue; a drift between the two raises an alert.

**Safety controls.** Keys stay with Circle; no private key exists in the app or browser. The entity secret lives only in backend secrets. Payouts are idempotent, amount-validated against the escrow row, and gated by the existing status-transition trigger so an escrow cannot pay out twice. Caveat to accept knowingly: holding user funds in a platform treasury is custody, which carries licensing implications in most jurisdictions and is the main reason to migrate to an on-chain escrow contract later.

**Who releases funds.** Buyer-initiated release is the default path. A scheduled job auto-releases funded escrows after a delivery-confirmation window when the buyer goes silent. Disputes go to a human arbitrator role in the admin queue. AI stays out of the money path: an agent may summarise chat and evidence to assist a decision, but never authorises a transfer.

## Effort estimate

- Phase 1 (real treasury, payouts, ledger, reconciliation): roughly 10-14 credits.
- Phase 2 (roles, dispute queue, moderation, auto-release): roughly 8-11 credits.
- Phase 3 (email, search, legal pages, dead-code cleanup): roughly 7-10 credits.

Total roughly 25-35 credits. Each phase ends in a working, testable state rather than one large pass.

