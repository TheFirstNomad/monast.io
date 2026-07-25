## Session 3 — Circle Escrow integration (biggest MVP unlock)

Goal: replace direct USDC transfers with a Circle-backed escrow so a buyer's funds are held until delivery is confirmed (or refunded on dispute). Existing `escrows` table already has the shape we need.

### Flow

```text
Buyer clicks Buy
   -> POST /escrow-create   (edge fn)
        - validates ad + amount (or accepted offer)
        - creates Circle escrow / holding wallet
        - inserts escrows row status='created'
Buyer funds escrow
   -> Circle wallet SDK (email user)  OR  wagmi USDC transfer (self-custody)
   -> POST /escrow-confirm-funded   (edge fn)
        - verifies on-chain deposit via _shared/tx-verify
        - status='funded', funded_at=now()
Seller ships / delivers
Buyer clicks "Confirm received"
   -> POST /escrow-release
        - releases funds to seller (Circle transfer)
        - status='released', marks ad sold, records payments row
Either party opens dispute (v1: manual admin)
   -> POST /escrow-dispute   (status='disputed')
Refund path
   -> POST /escrow-refund  (admin or seller-initiated)
        - status='refunded'
```

### Work items

1. **Edge functions** under `supabase/functions/`:
   - `escrow-create` — validates buyer/ad/amount, creates Circle escrow record, inserts row.
   - `escrow-confirm-funded` — verifies deposit tx via `_shared/tx-verify.ts`, flips status.
   - `escrow-release` — buyer-only; releases to seller, writes `payments` row, marks ad sold.
   - `escrow-refund` — seller-or-admin; refunds buyer.
   - `escrow-dispute` — either party; sets `status='disputed'`.
   All use service-role client, validate `auth.uid()` matches buyer/seller, and update `tx_hashes` jsonb.

2. **Config** — add each function to `supabase/config.toml` with `verify_jwt = true` (except any webhook Circle calls back on, which stays `false` and validates a signature).

3. **Client**:
   - New `src/components/EscrowButton.tsx` replacing `PayButton` on `AdDetail`.
   - `src/pages/EscrowDetail.tsx` — shows escrow state, action buttons (Confirm received / Open dispute / Refund).
   - Dashboard tab "Escrows" listing buyer + seller escrows, using existing `escrows_select_participant` policy.
   - Circle-wallet users fund via `@circle-fin/w3s-pw-web-sdk` transfer; self-custody users fund via wagmi. Both hit `escrow-confirm-funded` with the tx hash.

4. **Safety**
   - Trigger enforcing status transitions: `created → funded → released|refunded|disputed`, `disputed → released|refunded`. Nothing else.
   - `payments` insert only happens inside `escrow-release` edge fn (service role) to preserve current "verified on-chain" invariant.

5. **Out of scope this session**
   - Automated dispute resolution UI (v1 = manual admin action).
   - Migrating agent-api / MCP payments onto escrow (Session 4).
   - Notifications (Session 5).

### Pause points
- After (1) + (2): backend ready, no UI change.
- After (3): full happy-path buy → confirm → release working.
- After (4): status-transition trigger + tests.

### Deliverable
On `/ad/:id`, buyer clicks Buy → escrow row created → funds sent (Circle wallet or self-custody) → verified → seller sees "Awaiting delivery" → buyer clicks "Confirm received" → funds released, ad marked sold, review unlocked. Refund + dispute paths reachable but resolved manually for v1.
