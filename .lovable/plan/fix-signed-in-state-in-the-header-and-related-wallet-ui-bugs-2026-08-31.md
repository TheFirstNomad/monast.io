# Fix signed-in state in the header (and related wallet UI bugs)

## What's wrong today

The header's account button labels itself from the **wallet address only**. A user signed in with Google has a valid session but no self-custody address, so they keep seeing "Connect" — even on the dashboard where the same page already shows their email and a "Sign out" button. The dropdown itself already switches to the account menu, so the bug is the label plus the wallet-flavoured wording around it.

Two more inconsistencies found in the same area:

- Mobile menu's signed-out entry says "Sign in with wallet", hiding the Google option.
- The wallet page shows a raw provider failure ("Your wallet provider could not complete that request") above a 0 USDC balance, with no retry framing, and the empty-state copy tells signed-in Google users to "sign in with Google to get a monast wallet".

## What changes

1. **Header account button reflects the real session.**
   - Signed in with Google: show an avatar initial + shortened email (e.g. "mohamednuux") instead of "Connect".
   - Signed in with a self-custody wallet: keep the shortened address.
   - Signed out: "Sign in" (not "Connect"), and the menu offers exactly the two supported paths — Continue with Google and Connect wallet — both routing to `/auth`, which already hosts the real flows.
2. **No wallet-connect prompts for social users.** When a session exists without a self-custody address, the dropdown/mobile menu drop the "Connect wallet" action and show the monast wallet entry instead (link to `/wallet`). Signing out uses the session sign-out path for social users, wallet disconnect for wallet users.
3. **Mobile menu parity** with the desktop dropdown: same labels, same signed-in detection, "Sign in" instead of "Sign in with wallet".
4. **Wallet page polish.** Balance errors render as a calm inline retry message rather than red provider text; the no-wallet empty state stops telling an already-signed-in user to sign in.

## Technical notes

- `src/components/Navbar.tsx`: derive display state from `useAuth().user` + `useWallet().address` (`walletUser` vs `socialUser`), replace the label/menu branches, keep admin/role logic untouched.
- `src/pages/Wallet.tsx`: error and empty-state presentation only.
- No backend, escrow, or auth-logic changes. If the 0 USDC + provider error persists after this pass, that is a separate Circle balance investigation I'll take next on your word.
