# Fix Circle transfer fee parameter

## Confirmed state
`supabase/functions/circle-transfer/index.ts` (line 240) sends the transfer body with a nested
`fee: { type: "level", config: { feeLevel: "MEDIUM" } }`. Circle's REST endpoint
`POST /v1/w3s/user/transactions/transfer` does not read that shape, so it treats the fee as
unset and rejects the call with `code 2` demanding `gasPrice`/`gasLimit`.

## Change
Replace the nested `fee` object with the REST field `feeLevel: "MEDIUM"` at the top level of the
request body. Nothing else in the body changes: `walletId`, `destinationAddress`, `tokenId`, and
`amounts` stay as they are, and no `gasPrice`, `gasLimit`, `maxFee`, `priorityFee`, or nested
`fee` is sent.

One deliberate deviation from the suggested snippet: keep the existing derived
`idempotencyKey` (`idempotencyKeyFor(purpose:referenceId)`) instead of `crypto.randomUUID()`.
The derived key is what stops a double-click from charging the listing fee twice; a random key
per attempt would remove that protection. It is not related to this error.

## Then
Redeploy only `circle-transfer`, retry the 0.15 USDC publish on the DELL Latitude listing, and
read the fresh function logs to confirm Circle accepts the transfer and returns a challenge.

## Untouched
USDC token ID secret, Google login, `circle_sessions`, deposit UI, and every other function.
