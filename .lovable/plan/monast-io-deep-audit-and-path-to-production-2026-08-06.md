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

**Who controls the treasury.** In Phase 1 the keys sit with Circle, but only the monast.io backend can authorise a transfer using the API key plus entity secret. That means the platform owner controls it and the model is custodial: users trust monast.io rather than code. This is the deliberate trade-off of shipping fast, and the reason Phase 2 exists.

## Trustless escrow (Phase 2)

Phase 2 replaces custody with an on-chain escrow contract:

```text
Buyer -> escrow contract (holds USDC, per-deal)
         release()  by buyer   -> 99% seller, 1% revenue wallet
         refund()   by seller  -> 100% buyer
         resolve()  by arbitrator role, dispute only
         autoRelease() after the confirmation window
```

The platform never takes possession of funds; the app only reads contract state and submits transactions. The contract stays deliberately tiny — deposit, release, refund, resolve, autoRelease and nothing more — so it is cheap to review, and it must be audited before meaningful volume. This is the one part of the build where a mistake is unrecoverable, which is why it is not bundled into Phase 1.

**Who deploys it and where.** The contract source is written and compiled inside this project; the owner never uses a terminal. Deployment is submitted by a backend function through Circle's Smart Contract Platform, with the Circle developer-controlled wallet acting as deployer and paying gas. That makes the same wallet the contract owner, which is what allows setting the arbitrator role and the fee recipient afterwards.

- Triggered from an owner-only admin screen: choose network, confirm, done.
- Arc Testnet first, exercised through a full fund / release / refund / dispute cycle with test USDC, then the identical bytecode goes to the production chain.
- One deployment per supported chain; the resulting addresses and deploy tx hashes are stored in the chain config and shown in the admin panel for auditability.

**Target networks.** Arc Testnet is the only live network until Arc Mainnet launches on Sep 16, 2026. Base and Sepolia stay available for wallet compatibility, Tempo entries get disabled until their USDC address is published. On Sep 16 the same audited bytecode is deployed to Arc Mainnet from the admin screen and the chain config flips `arc-mainnet` to enabled — no code rewrite, just a deploy plus a config change. Everything in Phase 1 and 2 is built and rehearsed on Arc Testnet first so mainnet day is a deployment, not a build.

**Relation to Circle's reference contracts.** Circle publishes several escrow/payment reference implementations (`refund-protocol`, `arc-escrow`, `arc-ecommerce-payments`). They solve overlapping but different problems, so the plan is to read the current source of each before writing ours rather than assume:

- A refund-protocol style contract is about reversible payments: funds move to the merchant with a time-boxed window in which the payer can be refunded. Good for card-like commerce, weaker for P2P where the buyer wants funds withheld until delivery.
- An escrow-style contract is closer to what monast.io needs: funds locked per deal, released on confirmation, refundable, with a third-party resolver for disputes.
- An ecommerce-payments style contract targets checkout flows — authorise, capture, settle — with a merchant on one side rather than two anonymous peers.

What monast.io needs on top of any of them: per-ad deal linkage, a 1% fee split at release, an arbitrator role we control, and an auto-release timer. Decision to make once the sources are read: fork the closest Circle contract and add those, or write a minimal contract and borrow their patterns. Forking a Circle-audited base is preferred if it fits, because it inherits their audit.

**Can a depositor withdraw if they change their mind?** Yes, with rules that protect both sides:

```text
created  (nothing deposited)      -> buyer or seller cancels freely, no cost
funded   (USDC locked)            -> buyer requests cancel; seller approves -> full refund
                                  -> seller ignores past a timeout -> buyer refund unlocks
                                  -> seller marked delivered -> becomes a dispute, arbitrator decides
released / refunded               -> terminal, nothing to withdraw
```

A buyer cannot unilaterally pull funds out of a funded escrow the instant a seller has shipped — that would make the escrow useless for sellers. The seller-approval path plus the timeout is what keeps it fair without a human in the loop for the common case.

**Charges on cancellation and refund.** No platform fee on any refund: a cancelled or refunded escrow returns 100% of the USDC to the buyer. The only unrecoverable cost is gas, which on Arc is paid in USDC and is a fraction of a cent. The 0.15 USDC listing fee stays non-refundable since it exists to price spam. The 1% fee is charged only on a successful release.

## Arc Mainnet cutover (Sep 16) and audit

**Nothing happens automatically, by design.** An automatic mainnet flip is exactly how real money gets lost. The cutover is a short, owner-triggered checklist:

```text
1. Add Arc Mainnet to the chain config: chain id, RPC, official USDC address, explorer.
   -> the real USDC address only exists once Arc Mainnet is live; it must be read from
      Circle's own docs, not guessed. Today's arc-mainnet entry is a placeholder.
2. Create the Circle wallets (escrow + revenue) on Arc Mainnet.
3. Deploy the audited escrow contract from the admin screen; record address + tx hash.
4. Smoke test with a tiny real amount: fund 1 USDC, release, refund. Owner's own funds.
5. Flip arc-mainnet to enabled. Arc Testnet stays enabled for ongoing testing.
```

Steps 1-3 are roughly one build session; step 4-5 the same day. If Arc Mainnet slips past Sep 16, nothing breaks — the app keeps running on Arc Testnet.

**Who audits, and can it be done on both networks.** Auditing is done on the source code, not on a network, so one audit covers both deployments provided the bytecode is identical — which is why the plan deploys the same compiled artifact to testnet and mainnet and records both addresses. There is no such thing as "auditing the mainnet copy" separately; what you do on mainnet is verify the deployed bytecode matches what was audited, which the explorer's contract verification shows publicly.

Realistic options, in order of what fits this project:

- **Fork a Circle-audited contract.** Cheapest and most reliable: inherit their audit, and keep our additions (fee split, arbitrator, timer) small enough to review in isolation. This is the recommended route.
- **Automated tooling plus a full test suite.** Slither/Aderyn static analysis, plus tests covering every state transition, reentrancy on release, double-release, wrong-amount deposits, fee rounding. I can build this inside the project. It catches common classes of bugs but is not a substitute for human review.
- **A paid human audit.** Independent firms (Trail of Bits, OpenZeppelin, Spearbit, Cantina) or a competitive contest platform (Code4rena, Sherlock). Budget for a small contract is realistically in the low tens of thousands for a firm; a contest can be cheaper. This is a decision for you, outside what I can do — I can prepare the audit package (source, spec, threat model, tests).
- **A bug bounty after launch,** plus a deposit cap for the first weeks so the maximum loss is bounded.

**How reliable is this honestly.** A forked Circle contract with a small reviewed delta, a full test suite, static analysis, and a per-escrow deposit cap is a defensible risk posture for launch. It is not the same as a clean report from a top-tier firm. I will not tell you a contract I wrote is safe because I wrote it — that judgement needs an independent reviewer, and until you have one the deposit cap is what limits the damage. The safest sequencing is: launch on Arc Testnet, run Phase 1's custodial flow with real but small amounts, and only move escrow on-chain once the contract has been reviewed.


## Fee model

- **Listing fee: 0.15 USDC per ad.** Charged when the ad is published, paid to the revenue wallet, verified on-chain before the ad becomes active. Purpose is spam prevention, so it is flat and non-refundable.
- **Platform fee: 1% of the sale.** Deducted from the escrowed amount at release: the seller receives 99% and 1% goes to the revenue wallet in the same payout step.
- **Cancellations and refunds: 0%.** The buyer gets the full amount back; the platform takes nothing on a deal that did not complete.
- Both rates live in one shared config so client, backend, and contract cannot drift, and every fee movement is written to the ledger table.

## Decentralisation stance

No KYC/AML, no identity gating, no sanctions screening — the marketplace stays permissionless. A short privacy notice is still worth keeping because user emails are stored. Note plainly: while Phase 1 custody is custodial, "decentralised" describes the intent rather than the actual trust model; it becomes accurate once the escrow contract is live.

## Effort estimate

- Phase 1 (real treasury, payouts, fees, ledger, reconciliation): roughly 12-16 credits.
- Phase 2 (escrow contract, arbitrator role, dispute queue, moderation, auto-release): roughly 14-20 credits.
- Phase 3 (email, search, analytics, dead-code cleanup): roughly 6-9 credits.

Total roughly 32-45 credits. Each phase ends in a working, testable state rather than one large pass.


