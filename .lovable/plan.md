# Flip monast.io to Arc mainnet

No rebuild needed: the network switch was built to be configuration plus two new
treasury wallets. Work stops for your review before mainnet becomes the default
settlement network.

## Step 1 — Live credentials, secure form only

I open the encrypted secret form for you to paste, never chat:

- `CIRCLE_API_KEY` (live, starts with `LIVE_API_KEY:`)
- `CIRCLE_ENTITY_SECRET` (the new mainnet entity secret you registered in Circle)
- `CIRCLE_CLIENT_KEY` (live client key bound to monast.io)

Your existing user-controlled App ID stays as it is; no new App ID. The client key
is stored but only used where the code already expects one — Google sign-in and
the user-controlled wallet path are not rebuilt.

## Step 2 — Mainnet constants

Saved as backend configuration and build values:

- Blockchain code `ARC`, chain id `5042`
- RPC `https://rpc.mainnet.arc.io`
- Explorer `https://explorer.arc.io`
- USDC contract `0x3600000000000000000000000000000000000000`
- Circle ERC-20 USDC token id `5677d668-490d-51d3-82c7-b2b8313df2f4`

Chain id `5042002` stays as the testnet value only. The previously assumed
`5042001` is removed everywhere so nothing can settle on it.

One correction to make in code: the app currently hardcodes `5042001` as the
mainnet chain id and `arcscan.app` as the mainnet explorer, in the chain registry,
the wallet/App Kit helper and every explorer link. Those become `5042` and
`https://explorer.arc.io`, read from configuration rather than hardcoded.

## Step 3 — Two new mainnet treasury wallets

Created with the live key and new entity secret, on blockchain `ARC` only, using
the same account type as today's treasury wallets:

- Wallet set: `monast.io mainnet treasury`
- Wallet 1 name: `escrow wallet`
- Wallet 2 name: `revenue wallet`

No testnet wallet id is reused. The returned wallet ids and addresses are stored
as configuration, and I give you the two addresses so you can fund them with real
USDC.

## Step 4 — Wire and gate

Escrow deposits and releases use the escrow wallet; listing fees, promotions and
platform fees use the revenue wallet. Mainnet payments stay refused until both
wallets exist and their ids are saved — the code already fails loudly rather than
sending funds to an unowned address.

## Step 5 — Full stop, then a checklist for you

Work stops after the secrets are saved and the two wallets exist. I show you: every
secret and configuration value that was set, both mainnet wallet addresses, the
chain/RPC/explorer values in effect, and confirmation that testnet is untouched.
Default settlement does not move to mainnet, and fees/escrow/revenue are not wired
to the new wallets, until you have funded them and told me to continue.

## Step 6 — Small live smoke test

With real USDC in the wallets: publish a listing (fee), fund one escrow, release
it, and confirm each step on `explorer.arc.io`. Use a small amount for the first
pass.

## Safety

- Existing testnet listings and escrows keep settling on testnet and keep working.
- The live API key and entity secret stay backend-only; the frontend gets the
  client key and App ID and nothing else.
- Separate escrow and revenue wallets, so buyer funds and platform revenue never
  mix.

## Technical detail

Backend secrets: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_CLIENT_KEY`,
`CIRCLE_ARC_MAINNET_BLOCKCHAIN=ARC`, `ARC_DEFAULT_CHAIN_ID=5042`,
`ARC_MAINNET_RPC_URL`, `ARC_MAINNET_EXPLORER_URL`, `ARC_MAINNET_USDC_ADDRESS`,
`CIRCLE_USDC_TOKEN_ID_ARC_MAINNET`, then `CIRCLE_ESCROW_WALLET_ID` and
`CIRCLE_REVENUE_WALLET_ID` after creation.

Frontend build values: `VITE_ARC_MAINNET_USDC`, `VITE_ARC_MAINNET_RPC`,
`VITE_ARC_CHAIN_ID=5042`.

Code touched: `src/lib/chains.ts` (mainnet id 5042, explorer explorer.arc.io,
chain id from `VITE_ARC_CHAIN_ID`), `src/lib/arcAppKit.ts` (`PaymentChainId`,
`chainString`, `getExplorerUrl`, `getChainLabel`), any remaining hardcoded
`arcscan.app`/`5042001` explorer helpers, `supabase/functions/_shared/arc-chains.ts`
(`ARC_MAINNET_CHAIN_ID = 5042`, explorer + RPC from env, mainnet-live check keeps
requiring both a real USDC address and the Circle mainnet token id),
`supabase/functions/treasury-provision/index.ts` (named wallet set and named
escrow/revenue wallets, mainnet chain in the provision request). Then redeploy the
money-path functions and re-run the test suite.
