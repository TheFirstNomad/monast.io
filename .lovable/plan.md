# Day 1 - email sign-in + Circle wallet provisioning (5 credits)

Day 1 of the 3-day split. Goal: email sign-in goes live alongside wallet connect, and email users get a Circle wallet. Funding for email buyers is Day 2; full verification is Day 3.

## Phase 0 - sender domain (start first, runs in background)

Kick off email domain setup for `monast.io` (or `notify.monast.io`) and brand the magic-link template from the existing theme colors and logo. DNS can take up to 48h. Everything below works immediately with the current default sender and picks up the branded sender automatically once DNS verifies.

## Phase 1 - email sign-in option

- `src/components/SignInChoice.tsx`: add a `wallet` / `email` mode toggle. Email mode collects an address and calls `signInWithOtp` with `emailRedirectTo: ${origin}/auth`, then shows a "check your inbox" state. The wallet path stays exactly as it is today.
- `src/pages/Auth.tsx`: on session, send synthetic `@wallet.monast.io` (self-custody) users straight to `/dashboard`; for email users call `circle-provision-wallet` once, then either redirect (`status: "ready"`) or open `WalletSetupDialog` for PIN setup.
- `src/test/hackathon-surface.test.ts`: narrow the parked-feature guard so it still blocks Swap and `arcAppKit` but permits the email + Circle sign-in path; keep asserting there is no `/swap` route.
- Raise the auth email rate limit so magic links don't hit the low default hourly cap.

## Day 1 outcome

Email users can sign in with a magic link and get a Circle wallet on Arc. They can browse, list and sell. Funding an escrow as an email buyer still needs the Day 2 work (`circle-escrow-fund` wiring), so buying stays wallet-only until then.

## Not in Day 1

- Circle funding path for email buyers (Day 2, ~4 credits)
- Typecheck, full vitest run, headless screenshots (Day 3, ~2 credits)

## Technical notes

No schema changes: `profiles.circle_user_id` and `profiles.circle_wallet_address` already exist. `circle-provision-wallet` is already deployed with JWT verification on and is idempotent, so calling it after every email login is safe.
