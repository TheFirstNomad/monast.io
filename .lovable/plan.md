## Goal
Begin the unified onboarding build: **Email OTP → auto-provisioned Circle multichain wallet**, alongside the existing **self-custody wallet connect** flow. Scope this session to what ~4 credits can safely deliver, with clean pause points.

## Session 1 scope (this session, ~3–4 credits)

### 1. Wire Circle credentials
- Save `CIRCLE_APP_ID` as a non-secret constant in `src/lib/circle/config.ts` (it's a public identifier, safe in code).
- Confirm `CIRCLE_API_KEY` is already stored in the secret manager (server-side only, used by edge functions — never shipped to the browser).

### 2. Email OTP auth surface
- Add a new `/login` page with two clear paths:
  - **"Continue with email"** → Supabase email OTP (magic link + 6-digit code fallback).
  - **"Connect wallet"** → existing Reown AppKit + SIWE flow (already built).
- Update `Navbar` sign-in entry point to route to `/login`.

### 3. Circle wallet provisioning edge function
- Create `supabase/functions/circle-provision-wallet/index.ts`:
  - Triggered after first successful email OTP login.
  - Calls Circle User-Controlled Wallets API using `CIRCLE_API_KEY` to create a `userId` + initialize a wallet set on Arc / Base / ETH.
  - Returns a `userToken` + `encryptionKey` to the client so the Circle Web SDK can complete PIN setup (non-custodial — Circle never sees the PIN).
  - Persists the Circle `user_id` and provisioned addresses into the existing `user_wallets` table (source = `'circle'`).

### 4. Client-side Circle SDK handshake
- Install `@circle-fin/w3s-pw-web-sdk`.
- Create `src/lib/circle/client.ts` initializing the SDK with `CIRCLE_APP_ID`.
- Create `WalletSetupDialog.tsx` that runs after first email login: prompts the user to set a PIN + security questions, finalizing the Circle wallet.

### 5. Pause point
Stop after the email OTP flow provisions a Circle wallet and stores addresses in `user_wallets`. Escrow contract integration and multi-wallet management UI = **Session 2 tomorrow**.

## Explicitly out of scope this session
- Circle escrow contract calls (deferred to Session 2).
- Migrating existing payments (`PayButton`, agent-api, mcp) off direct USDC transfer onto Circle escrow (Session 3).
- Social login providers inside Circle (we're using Supabase for auth; Circle is wallet-only).

## Technical notes
- `CIRCLE_APP_ID` is a public client identifier by Circle's design — treated like a Supabase anon key, safe in the bundle.
- `CIRCLE_API_KEY` stays server-side in edge functions only. Never imported into `src/`.
- The `user_wallets` table (created previously) already has the shape we need: `user_id`, `address`, `chain`, `source`, `is_primary`.
- Email OTP uses Supabase's built-in `signInWithOtp` — no new auth provider config needed beyond confirming email is enabled.
- If credits run out mid-step, safe pause points are: after step 2 (auth UI only), after step 3 (backend ready), or after step 4 (full flow).

## Deliverable at session end
A user can visit `/login`, enter an email, receive an OTP, land back in the app signed in, and have a Circle multichain wallet provisioned + PIN set. Self-custody wallet connect continues to work unchanged.