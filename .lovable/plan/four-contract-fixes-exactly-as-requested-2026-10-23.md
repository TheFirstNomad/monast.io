# Four contract fixes (exactly as requested)

## Before starting: one blocker
- **Fix 1 cannot be done yet:** `public/MonastEscrowV3-abi.json` does not exist in the project. Please upload the ABI file from Arc Studio in chat (or paste it), and it will be placed there and copied over `src/lib/monastEscrowAbi.json`.
- **Risk on Fix 2:** the current ABI lists `createListing` with only 2 inputs. If the live contract at 0xcA19…1eBA really takes 2, adding a third argument will make every publish fail. Before applying Fix 2, the build step will read the live contract on Arc to confirm it supports the 3-argument version (and `fundEscrowWithOffer`). If it does not, Fix 2 is skipped and you are told why.

## Fixes
1. Replace `src/lib/monastEscrowAbi.json` with the new ABI file contents (also mirror into `supabase/functions/_shared/monastEscrowAbi.json` only if you confirm — otherwise left untouched as instructed).
2. `src/pages/PublishAd.tsx`: `createListing` args become `[price, 1n, 0x00…00 (bytes32)]`.
3. `src/lib/chains.ts`: testnet RPC `https://rpc.testnet.arc.network` -> `https://rpc.testnet.arc.io`.
4. `src/lib/monastEscrow.ts`: add `UnauthorizedEscrowParty`, `ListingNotCancellable`, `ReadyAlreadySet`, `AutoReleaseNotSet` messages to the error map.

Nothing else changes. Existing tests are run afterwards.
