# Add the Circle Kit Key and fix the swap sign-in step

## 1. Getting the Kit Key in (no files for you to edit)

Neither the frontend key nor the backend key is set yet, so swaps currently fail at execution.

Where to get it: in the Circle console, open **App Kit** (Build / App Kit section) and create or copy a **Kit Key**. It looks like `KIT_KEY:...`. It is a client-side key, like a publishable key.

Then just paste it into the chat here and I will:
- store it as the backend secret `ARC_KIT_KEY`, used by the `circle-proxy` function that relays Circle API calls, and
- set `VITE_ARC_KIT_KEY` so the swap panel can build the App Kit client,
- redeploy `circle-proxy`, and
- run a live quote/swap check on Arc Testnet and report the result.

You never touch a file or a terminal — one paste is all that's needed.

## 2. Swap should offer both sign-in options

Today the swap panel's "Connect wallet to swap" button jumps straight to the WalletConnect / MetaMask modal, so email users with a Circle wallet have no way in from the swap screen.

Change: make the swap button open the same chooser you already have on the sign-in page —

```text
Sign in to monast.io
Pick how you want to trade. Either option pays and receives USDC on Arc.

[ Continue with email ]        -> Circle user-controlled wallet
        or
[ Connect self-custody wallet ] -> MetaMask / WalletConnect / etc.
```

- The two-option card gets pulled out of the sign-in page into one reusable dialog so the sign-in page and the swap panel (and the swap page) always look identical.
- After either path completes, the dialog closes and the swap panel continues with the now-connected wallet — no page reload, no losing the amount already typed.
- The navbar Swap button behaves the same when nobody is signed in.

## 3. Swap with a Circle (email) wallet

The swap panel signs through the connected browser wallet provider today. For Circle email wallets, the swap is signed with the Circle PIN challenge flow already used for escrow funding, so an email user can swap without a browser extension. If Circle App Kit turns out not to accept the Circle user-controlled wallet as a swap signer on Arc Testnet, the panel will say so plainly on that account instead of failing with a raw error, and email users keep full escrow/checkout functionality.

## Technical notes

- New `src/components/SignInChoiceDialog.tsx` holding the existing email + self-custody card; `src/pages/Auth.tsx` and `src/components/SwapPanel.tsx` both render it.
- `SwapPanel` gates on `useAuth` session + `useWallet` address, opening the dialog instead of calling `connect()` directly.
- Circle-wallet swap path reuses `runCircleChallenge` from `src/lib/circle/client.ts`; no schema change, no new tables.
- Secrets: `ARC_KIT_KEY` (backend) and `VITE_ARC_KIT_KEY` (frontend), same value.
