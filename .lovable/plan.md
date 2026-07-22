
# Step 1 only — Store Circle credentials, then stop

You have ~1 credit left, so this plan intentionally does **only the secret-storage step**. Building the actual features resumes tomorrow when your credits refresh.

## What happens the moment you approve

1. Open the secure secret form for `CIRCLE_API_KEY` so it's saved on the server as an environment variable (not in the chat transcript).
2. Set `VITE_CIRCLE_APP_ID = a8b80470-0e58-5523-83e8-5f78de4b8fcb` in the public env file (this ID is public and safe to commit).
3. Stop. No code changes, no edge functions, no UI work today.

## After you approve — one-time housekeeping on your side

- In the Circle console (Developers → API Keys), delete the current key and create a fresh one. Sandbox keys have no real risk, but rotating removes any trace from this chat.
- Tomorrow, paste the new key into the secure form I'll reopen — takes 5 seconds.

## Tomorrow's plan (resumes after credits refresh)

The full monast.io + Circle build:

1. Enable Email OTP in Lovable Cloud Auth.
2. Two-tab `/auth` page: "Continue with email" (OTP) + "Connect wallet" (SIWE, existing).
3. Edge function `circle-user-provision` — on first email sign-in, creates a Circle user, session token, and multichain wallet (Arc / Base / Ethereum); writes `profiles.circle_wallet_address` and `user_wallets` primary row.
4. `<CircleWalletProvider>` in the browser using `@circle-fin/w3s-pw-web-sdk` for PIN setup + tx signing.
5. Rework checkout to use Circle's Arc-native escrow (`escrow-create`, `escrow-fund`, `escrow-release`, `escrow-refund`, `escrow-webhook`) instead of raw USDC transfer.
6. Extend `agent-api` and `mcp` with escrow tools so AI shoppers use escrow by default.

Database (`user_wallets`, `escrows`, `profiles.circle_*`) is already migrated.

```text
Email OTP ─┐
           ├─► Supabase user ─► profiles + user_wallets
SIWE     ──┘                         │
                                     ▼
                    ┌── Circle User-Controlled Wallet (Arc/Base/ETH)
                    └── External self-custody wallet(s)
                                     │
                                     ▼
                         Circle Arc Escrow primitive
                    (create → fund → release / refund / dispute)
```
