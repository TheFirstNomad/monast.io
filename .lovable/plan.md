# monast.io — Fix Brief Implementation (Phase A first)

I read the brief and checked every Phase A claim against the actual code before writing this. Findings:

- **#1 confirmed.** `_shared/payout.ts` builds `mainKey` then passes `crypto.randomUUID()` to Circle; the fee sweep a few lines down has the same bug.
- **#2 confirmed.** `treasury-withdraw/index.ts` builds a `Date.now()`-based key, then passes `crypto.randomUUID()` to Circle, with no `claimPayout`-style lock.
- **#3 confirmed.** No unique index on `escrows.deposit_tx_hash` (checked the live database indexes). `payments.tx_hash` and `ads.listing_fee_tx_hash` both have one.
- **#4 confirmed.** `getTransaction` exists in `circle-dev.ts` and is called nowhere; `updateLedgerStatus` in `ledger.ts` is also never called.
- **#11 confirmed.** `src/lib/arcAppKit.ts` line 17 is `"KIT_KEY:proxy"` (two segments).
- **#12 confirmed as described.** `kit.send` in `payListingFee` is not wrapped in `withCircleProxy`, while `kit.swap` is.

Nothing here requires touching the two-wallet custody model or the schema beyond one index. No corrections to the brief so far.

## Phase A — before any real testnet USDC

**1. Kit key placeholder (#11)** — change `ARC_KIT_KEY` to `"KIT_KEY:proxy:proxy"` so the SDK's local format check passes and calls reach `circle-proxy`, which already injects the real server-side key.

**2. Listing-fee proxy (#12)** — wrap the `kit.send` call in `payListingFee` with `withCircleProxy(...)`, matching `swapViaKit`. Since the brief flags this as unconfirmed, I'll test the flow and report whether it was actually broken.

**3. Escrow payout idempotency (#1)** — in `payout.ts`, pass `mainKey` to the main transfer and `` `escrow:${escrow.id}:fee` `` to the fee-sweep transfer. Add a structured `PAYOUT_BLOCKED` log line when `claimPayout` refuses, so repeated blocked attempts are greppable.

**4. Withdrawal idempotency + lock (#2)** — accept an optional `client_request_id` in the request body; derive the key as `withdrawal:<chainId>:<to>:<amount>:<client_request_id>` with no timestamp, and pass it to `treasuryTransfer` (same key used for the ledger row). Add a concurrency guard: a `treasury_withdrawals` claim row keyed on the idempotency key, inserted before the Circle call, so a duplicate insert (23505) returns a clean "withdrawal already in progress" instead of a second transfer. The admin UI sends one `client_request_id` per attempt.

**5. Deposit tx_hash uniqueness (#3)** — migration adding the partial unique index on `lower(deposit_tx_hash)`, plus catching `23505` in `escrow-confirm-funded` and returning 409 "This transaction has already been used to fund a different escrow."

**6. Reconciliation job (#4)** — new `payout-reconcile` edge function on the existing 15-minute cron: find escrows with `payout_status = 'sent'` (and pending ledger rows) older than ~2 minutes, call `getTransaction` on the Circle transaction id, then flip to `confirmed` (with the real `tx_hash` via `updateLedgerStatus`) or `failed`. Failures write a `payout_alerts` row and a `RECONCILE_FAILURE` log line. Escrow status is left untouched on failure rather than being rewritten to look successful.

**7. Test the Phase A fixes** using the brief's checklist, and report each result honestly as pass / fail / couldn't-test:
- Concurrent double-call on release and on withdrawal (two parallel requests) — expect exactly one transfer, second gets a clean rejection.
- Retry after a simulated post-transfer failure (forcing `payout_status: failed`) — expect the retry to reuse the same idempotency key, not send new funds.
- Same `tx_hash` against a second escrow — expect 409 and no status change.
- Reconciliation against a bogus `circle_transaction_id` — expect `failed` plus an alert row.

Where a test needs real Circle sandbox transfers I can't originate, I'll say so explicitly rather than claiming a pass.

## Phase B — before mainnet (not started until Phase A is done and tested)

#5 confirmation depth, #6 stable funding-challenge key, #8 user rate limiting on the money endpoints, #7 integer currency math (its own task), #9/#10 hygiene, plus the frontend double-submit spot check.

## Technical notes

- One migration only: the `escrows` deposit-hash index, plus small tables for withdrawal claims and payout alerts (with GRANTs and RLS — service-role only for claims, admin-readable for alerts).
- `.env` (#9): `.gitignore` currently does not list `.env`. I can't run git commands, so I'll add the ignore rule and flag that untracking the existing file has to happen on your side — the anon key in it is public by design, so nothing sensitive is exposed today.
- No changes to the custody model: the escrow wallet still has no withdrawal path, revenue withdrawal stays owner-only.
