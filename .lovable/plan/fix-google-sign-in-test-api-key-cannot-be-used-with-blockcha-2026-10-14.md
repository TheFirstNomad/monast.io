# Fix Google sign-in: "TEST_API key cannot be used with blockchain mainnets"

## Cause
Google sign-in now gets past the App ID step (last fix worked). The next step creates the user's wallet, and it still asks Circle for a wallet on the **test** network (`ARC-TESTNET`). Your Circle key is now the **live** key, and Circle refuses to make test-network wallets with a live key. The same leftover default exists in the email wallet setup.

## Fix
1. Google sign-in wallet setup and the email wallet setup both ask Circle for wallets on the live network (`ARC`), using the same shared network setting that escrow and payouts already use, instead of a hard-coded test default.
2. Check the stored wallet-network setting; if it is set to the test network, change it to `ARC`.
3. Deploy both services and confirm the sign-in start step no longer returns that error.
4. Publish so monast.io gets the fix.

## Note
Returning Google users who only had a test wallet get a new live wallet on next sign-in; old test wallets stay on the test network.

## Technical details
- `supabase/functions/circle-social/index.ts` and `supabase/functions/circle-provision-wallet/index.ts`: replace the `ARC-TESTNET` fallback of `BLOCKCHAINS` with the active blockchain code from `_shared/arc-chains.ts` (`ARC` on mainnet); `CIRCLE_UCW_BLOCKCHAINS` override still respected only if it holds `ARC`.
- Verify `CIRCLE_UCW_BLOCKCHAINS` secret value; update if testnet.
- Wallet sync/lookup filters that match on blockchain are checked for the same testnet assumption.
