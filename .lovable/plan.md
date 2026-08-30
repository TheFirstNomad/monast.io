# Fix Circle wallet: publish error, empty activity, orphaned withdrawal

## What the evidence shows (confirmed)

Both problems come from **one wrong Circle endpoint**.

The backend logs the exact failure, repeatedly:

```text
Circle /user/transactions?walletIds=1ed11f6b…&pageSize=50&operation=TRANSFER
404: {"code":-1,"message":"Resource not found"}
```

That call is the transaction-list lookup in `circle-transfer`. Circle only uses
the `/user/...` prefix for *creating* a transfer (`POST /user/transactions/transfer`);
listing and reading transactions is `GET /transactions` and `GET /transactions/{id}`
with the user token — which is exactly what the older, working `circle-tx-status`
function already uses. So every read path built on that list 404s:

- **Publish listing fails** — the publish page first asks "did a Circle transfer for
  this listing already happen?" (the `resolve` action). That call 404s, and the raw
  Circle 404 is what surfaces in the corner of your screenshot, so the fee flow
  stops before it starts.
- **Recent activity is always empty** — the wallet activity list is the same 404.
- **The 10 USDC withdrawal looked failed but wasn't** — the money moved (it arrived
  at `0x6cC4…cEb9`), but Circle's challenge result came back with no transaction id,
  and the withdrawal code has no fallback lookup, so it showed "approved but Circle
  has not published it yet" and never followed the transfer to its hash.

Balance reads use a different endpoint (`/wallets/{id}/balances`), which is why the
99.7 USDC balance displays correctly while everything else is blank.

## The fix

1. **Correct the Circle transaction endpoints** in `circle-transfer`: list via
   `GET /transactions?walletIds=…` and read one via `GET /transactions/{id}`, both
   with the user token, matching the proven `circle-tx-status` path. This single
   change repairs publish/`resolve`, activity, and status polling together.
2. **Defensive parsing** of the list response so either Circle response shape
   (`data.transactions` or `data.transaction`) works, and unknown fields never
   blank the list.
3. **Withdrawal recovery**: when the challenge returns no transaction id, look the
   transfer up by destination + amount (the existing `pickTransfer` matcher) and
   follow it to its hash instead of showing a scary message. Reuse the same
   duplicate-safe idempotency key so a retry can never send twice.
4. **Activity shows in-flight transfers too**, inbound and outbound, with state and
   ArcScan links, so a transfer is visible the moment Circle records it.
5. **Human-readable errors**: never surface a raw `Circle /path 404: {...}` string in
   the UI; log the technical detail and show plain language.
6. **Verify end to end** after deploy: read activity (your completed 10 USDC send
   should appear), then publish the "1 BTC FOR SALE" listing — the fee flow should
   detect any existing paid transfer rather than charging again.

## Technical notes

- `supabase/functions/circle-transfer/index.ts`: fix `listTransfers` and the
  `status` branch paths; add a `resolveWithdrawal` lookup used by the withdraw flow;
  keep session caching, rate limits and integer micro-USDC math unchanged.
- `src/lib/wallet/api.ts`: on a missing transaction id, call the new withdrawal
  resolve and continue polling; only error out if Circle genuinely has nothing.
- `supabase/functions/circle-transfer/pickTransfer.ts` is reused as-is; its unit
  tests get two cases for the withdrawal fallback.
- No schema changes, no UI redesign, no change to on-chain verification rules.

## Out of scope

Escrow logic, promotions, self-custody sign-in, admin treasury, agent API.
