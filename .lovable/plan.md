# Finish the mainnet switch so publishing works

## What is actually wrong

The backend was switched to Arc Mainnet (chain 5042) yesterday, but the website
itself is still set to the test network. The reason: the site only treats mainnet
as live when a mainnet USDC address is supplied as a build value, and no such
build value exists. So when you clicked "Pay 0.15 USDC and publish" from
MetaMask, the site asked your wallet for the test network and sent the fee to the
test treasury, while the backend expected a mainnet payment — so the listing
never published.

Note: Arc uses the same USDC contract address on both networks, so the address
can never be used as the "is mainnet live?" signal. That is the flaw to remove.

## The fix

1. Make Arc Mainnet the site's live network directly in the code, with the
   canonical values you supplied: chain 5042, USDC 0x3600…0000,
   RPC rpc.mainnet.arc.io, explorer explorer.arc.io. Readiness is an explicit
   switch, not guessed from the address.
2. Keep the test network defined so old test escrows and old listings still
   display and link correctly.
3. Wallet connection already knows both Arc networks; confirm MetaMask is
   prompted to add/switch to Arc Mainnet (chain 5042) with a clear message if you
   decline.
4. Re-check every place the network is decided — publish, promote, buy, escrow
   funding/release, send, receive, activity, wallet page — so all of them use the
   live network and show "Arc Mainnet".
5. Confirm the backend agrees: treasury lookups and the listing-fee verifier must
   resolve to chain 5042 and the mainnet revenue wallet
   0xd0d196f0164914bd52bec30e23d5eb1c2bc41186, escrow wallet
   0x357b1be7719845dd47eb47fc0cfa73402053c426.
6. Run the test suite and typecheck, then drive the publish screen in a browser
   to confirm the network prompt and fee flow no longer error.

## Existing listings

Your 6 active listings were published on the test network, so they cannot be
bought with real funds. After the switch they will be refused at checkout with a
"relist this item" message rather than taking money. You relist them when ready.

## Before real money moves

Both mainnet wallets must hold real USDC (escrow wallet needs gas/USDC to pay out).
Once you confirm they are funded, the smoke test is: publish a listing (0.15 USDC
fee) → fund one escrow → release it → confirm all three on explorer.arc.io.

## Technical detail

- `src/lib/chains.ts`: replace the address-derived `MAINNET_READY` with an
  explicit enable flag (env-overridable), default mainnet constants inline
  (5042 / rpc.mainnet.arc.io / explorer.arc.io / 0x3600…0000), keep
  `ARC_TESTNET_ID = 5042002` for historic records, `ACTIVE_CHAIN` → arc-mainnet.
- `src/lib/usdc.ts`, `src/lib/arcAppKit.ts` inherit from the registry — verify no
  remaining hardcoded testnet ids or arcscan.app links.
- `src/components/Web3Provider.tsx`: both chains stay registered; verify
  `switchChainAsync` reaches 5042 and MetaMask receives correct chain params.
- Backend: `_shared/arc-chains.ts` `defaultArcChainId()` already returns 5042
  when `ARC_DEFAULT_CHAIN_ID=5042` and both mainnet values are present — verify
  live via `treasury-address` and `treasury-status`, then redeploy the money-path
  functions.
- No changes to login, escrow rules, Agent API, or database schema.
