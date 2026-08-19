# Un-park email sign-in + Circle wallet (audited)

Claude's brief is sound in shape, but the audit found four things it misses. Below is the corrected plan plus the credit estimate.

## What the audit found

Verified in the project right now:

1. **The pieces exist and are unused.** `circle-provision-wallet` (idempotent, returns `ready` or a PIN challenge), `WalletSetupDialog`, the Circle Web SDK client, and `@circle-fin/w3s-pw-web-sdk` are all in place. Wiring is genuinely all that's missing.
2. **A test suite will fail the moment the code lands.** `src/test/hackathon-surface.test.ts` asserts that `SignInChoice.tsx` contains no `signInWithOtp`, and that `Auth.tsx`/`SignInChoice.tsx` never reference `WalletSetupDialog`. That guard was added for the hackathon cut and must be relaxed in the same change, or the build fails.
3. **Email users cannot actually trade yet.** Escrow funding (`EscrowFundButton`) requires a self-custody wallet via `useWallet()` and signs with the browser wallet. An email user gets a Circle wallet but has no funding path in the live UI (`CircleFundButton` and `circle-escrow-fund` exist but are parked). Without this, email sign-in produces users who can browse and list but not buy.
4. **No email sender domain is configured.** Magic links will send from the default Lovable sender until `monast.io` (or `notify.monast.io`) is verified. That is fine functionally, and DNS is slow, so it should be started first.

Also note: `circle-provision-wallet` is deployed with JWT verification on, which is correct, and self-custody users are distinguishable by their synthetic `@wallet.monast.io` email, so the skip check in the brief works.

## Plan

### Phase 0 - sender domain (start first, runs in background)
Kick off email domain setup for `monast.io` / `notify.monast.io` and brand the magic-link template from the existing theme. DNS can take up to 48h; the code below works with the default sender meanwhile and picks up the branded one automatically.

### Phase 1 - email sign-in option
- `src/components/SignInChoice.tsx`: add a `wallet` / `email` mode toggle. Email mode collects an address and calls `supabase.auth.signInWithOtp` with `emailRedirectTo: ${origin}/auth`, then shows a "check your inbox" state. Wallet path untouched.
- `src/pages/Auth.tsx`: on session, send `@wallet.monast.io` users straight to `/dashboard`; for email users call `circle-provision-wallet` once, then either redirect (`status: "ready"`) or open `WalletSetupDialog` for PIN setup.
- `src/test/hackathon-surface.test.ts`: narrow the guard so it still blocks Swap/`arcAppKit` but permits the email + Circle sign-in path; keep asserting no `/swap` route.
- Raise the auth email rate limit so magic links don't hit the low default cap.

### Phase 2 - make email users able to buy (recommended, not optional if you want them to transact)
Wire the parked Circle funding path into the escrow screen: when the signed-in user has a Circle wallet and no connected browser wallet, show the Circle funding button (PIN-approved transfer via `circle-escrow-fund`) instead of the wagmi transfer. Verify payout still resolves to the seller's payout address in both cases.

### Phase 3 - verification
Type-check, run the full vitest suite, and drive the sign-in screen headlessly to confirm both modes render and the email flow reaches the "check your inbox" state.

## Credit estimate

Rough, based on this project's file sizes and the test/deploy steps involved:

| Scope | Credits |
| --- | --- |
| Phase 0 - domain setup + branded auth email template | 2 |
| Phase 1 - email sign-in + Circle provisioning wiring + test guard fix | 3 |
| Phase 2 - Circle funding path for email users | 4 |
| Phase 3 - typecheck, tests, headless verification, fixes | 2 |

- **Minimum shippable (Phases 1 + 3): about 5 credits.** Email users can sign in and get a Circle wallet, but can only sell, not fund escrows.
- **Complete (all phases): about 10-11 credits.** Budget 12 if DNS or Circle sandbox behaviour needs a retry round.

Estimates assume no schema changes are needed - none are, `profiles.circle_user_id` and `circle_wallet_address` already exist.

## Open decision

Phase 2 is the difference between "email users can sign in" and "email users can buy". If credits are tight on the first day, Phases 1 + 3 ship safely on their own, and Phase 2 can follow the next day without rework.
