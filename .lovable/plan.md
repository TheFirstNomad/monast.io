# Fix Circle listing-fee publishing

## Confirmed state
- The listing is still `pending_fee`, belongs to user `ff9e37aa-2e3c-4744-aa32-84736097c0ba`, and has no recorded fee payment.
- That user has Circle wallet ID `1ed11f6b-be09-5864-8d42-716b242e7c3b`, a public Circle wallet address, and a stored refresh token.
- An active revenue treasury exists for Arc Testnet chain `5042002`.
- The `CIRCLE_USDC_TOKEN_ID_ARC_TESTNET` secret is present. Its encrypted value cannot be read back, so the exact UUID cannot be independently confirmed from the secret store.
- The deployed `circle-transfer` route responds and produced a fresh boot log, but no failed request log exists for the screenshot attempt. Therefore the exact Circle/API error is not recoverable from current logs; it must be captured by reproducing the request after error parsing is fixed.

## Implementation
1. Add a shared function-invocation error parser that safely reads `FunctionsHttpError.context` as JSON or text without assuming the response body is reusable. Prefer the backend `error`/`message`, then fall back to the SDK error.
2. Use it in `sendUsdc.ts` for both transfer creation and status polling, and in `PublishAd.tsx` for listing-fee verification, so every 4xx/5xx toast shows the actual backend response.
3. Correct the Circle transfer lifecycle:
   - Return Circle’s transaction ID from the initial `/user/transactions/transfer` response alongside the challenge ID.
   - Poll with that transaction ID rather than treating a challenge ID as a transaction ID.
   - Use Circle’s user-controlled transaction status endpoint and stop swallowing status-call failures.
   - Recognize failed/cancelled terminal states and surface their exact messages; keep polling only genuinely pending states.
4. Add focused tests for JSON/text function errors, create-challenge failures, status failures, and transaction-ID propagation.
5. Redeploy `circle-transfer`, invoke the listing-fee creation path for this listing while authenticated, and inspect the fresh function logs. Report the exact Circle error if one remains.
6. Recheck all prerequisites after deployment: configured token secret name, Circle wallet ID, refresh session, listing ownership, pending status, and active Arc revenue treasury. Then verify the payment reaches the Circle challenge instead of failing with the generic non-2xx message.

## Scope
Only the Circle payment transport, error surfacing, and the listing publish flow will change. No marketplace schema or unrelated UI will be modified.