# Flip monast.io to Arc mainnet

Good news: no code needs rewriting. The app was built so the network switch is
configuration only. What follows is the exact set of values needed and the order
to apply them in.

## What I need from you

1. **Live Circle API key** — you have it. I will open the secure form so you paste
   it directly into the encrypted store; it never appears in chat or in the code.
2. **Live Circle entity secret** — the 64-character value you generate in the
   Circle console and register there. If your live Circle account uses a different
   entity secret than the sandbox one, this must be updated too.
3. **Arc mainnet USDC contract address** — Circle must have published it for the
   Arc public network. Without a real address the app will keep settling on
   testnet by design, rather than sending money to an address nobody controls.
4. **Circle token ID for USDC on Arc mainnet** — visible in your live Circle
   wallet's balance list once the mainnet wallet holds USDC.

If items 3 and 4 aren't available yet, we can still switch the Circle credentials
to live and leave the network on testnet, then flip the network the moment Circle
publishes them.

## Order of work

1. Save the live Circle credentials through the secure form.
2. Save the Arc mainnet USDC address and Circle token ID.
3. Set the default settlement network to Arc mainnet.
4. Create the two live treasury wallets (escrow and revenue) on Arc mainnet from
   the admin console — mainnet payouts will not run until these exist, and they
   are separate wallets from the testnet ones.
5. Live smoke test with a small real amount: publish a listing (listing fee),
   fund one escrow, release it, and confirm the funds and the explorer links.
6. Confirm the wallet page, purchases and account screens all show the mainnet
   network and mainnet explorer links.

## Safety points before we go live

- Testnet and mainnet treasuries are different wallets. Existing testnet escrows
  stay on testnet and keep working; new activity goes to mainnet.
- The app refuses to accept payments on mainnet until a live treasury exists, so
  there is no window where money could land nowhere.
- Real money, real fees: the first test should be a small amount you are happy to
  lose if something needs another pass.

## Technical detail

Backend secrets to set: `CIRCLE_API_KEY` (live), `CIRCLE_ENTITY_SECRET` (live),
`ARC_MAINNET_USDC_ADDRESS`, `CIRCLE_USDC_TOKEN_ID_ARC_MAINNET`,
`ARC_DEFAULT_CHAIN_ID=5042001`, optionally `ARC_MAINNET_RPC_URL` and
`CIRCLE_ARC_MAINNET_BLOCKCHAIN`.

Frontend build values: `VITE_ARC_MAINNET_USDC`, optionally `VITE_ARC_MAINNET_RPC`.

`supabase/functions/_shared/arc-chains.ts` treats mainnet as live only when both a
real USDC address and the Circle mainnet token ID are present; `src/lib/chains.ts`
does the same check client-side. Chain id 5042001, explorer arcscan.app. After the
secrets land I redeploy the money-path functions and re-run the test suite.
