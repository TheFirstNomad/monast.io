# Wallet-based Sign In

## Goal
Make wallet connection THE primary sign-in. The moment a user connects their wallet via the Reown AppKit modal, they are authenticated in the app (Lovable Cloud session created) — no email/password required. Email + social login stay on the roadmap for the next build (Circle/Privy embedded wallets), but are removed from the current UI to avoid confusion.

## How wallet sign-in will work (SIWE — Sign-In With Ethereum)

Lovable Cloud auth doesn't natively support "wallet as identity", so we bridge it with a standard SIWE flow backed by an edge function:

```text
1. User clicks "Connect Wallet" → Reown AppKit modal → wallet connected (wagmi)
2. Frontend requests a nonce from edge fn `siwe-nonce`
3. Frontend asks wallet to sign a SIWE message containing that nonce
4. Frontend POSTs { message, signature } to edge fn `siwe-verify`
5. siwe-verify:
   - verifies the signature with viem `verifyMessage`
   - checks nonce is fresh & unused (stored in a new `siwe_nonces` table)
   - upserts an auth user keyed by `<address>@wallet.monast.io` (deterministic placeholder email, email_confirm=true, random strong password)
   - upserts `profiles.wallet_address = address`
   - returns a Supabase session (access_token + refresh_token) via admin API
6. Frontend calls `supabase.auth.setSession(...)` → user is signed in
```

This is the same pattern Privy/Dynamic/Thirdweb use under the hood, and it keeps RLS (`auth.uid()`) working unchanged across the app.

## UI changes

- **Navbar "Connect Wallet" button** = the single sign-in entry point. After connect+SIWE succeeds, the same button shows the short address and a dropdown with Dashboard / Sign out.
- **`/auth` page**: replace the email/password form with a big "Connect Wallet to continue" button (opens the AppKit modal). Add a small muted note: *"Email & social sign-in (with an embedded wallet) coming soon."*
- **Sign-out**: disconnects the wallet AND calls `supabase.auth.signOut()` together so the two stay in sync.
- **`useWallet` + `useAuth`**: `useWallet` triggers the SIWE handshake on every successful connect; `useAuth` is unchanged but will now reflect the wallet-derived session.

## Backend changes (one migration + one edge function folder)

- **Migration**: new table `public.siwe_nonces (nonce text pk, address text, created_at timestamptz, used_at timestamptz)` with RLS denying all client access (only the edge function via service role touches it). GRANTs to `service_role` only.
- **Edge functions** (public, `verify_jwt = false`, CORS enabled):
  - `siwe-nonce` — returns a fresh nonce, stores it.
  - `siwe-verify` — verifies signature, consumes nonce, creates/looks up the auth user, returns a session.

No changes to existing tables, RLS, or the security triggers added in previous passes — `auth.uid()` continues to gate everything.

## Out of scope (next build, per your note)
- Email magic-link / Google social login.
- Embedded wallets via Circle or Privy (decision pending). The placeholder email scheme (`<address>@wallet.monast.io`) is forward-compatible: when you pick Circle/Privy, we'll link the real email to the same auth user.

## Files touched
- `supabase/functions/siwe-nonce/index.ts` (new)
- `supabase/functions/siwe-verify/index.ts` (new)
- New migration for `siwe_nonces`
- `src/hooks/useWallet.tsx` — run SIWE after wagmi connect, manage sign-out
- `src/pages/Auth.tsx` — replace form with Connect-Wallet CTA
- `src/components/Navbar.tsx` — small dropdown on the address chip (Dashboard, Sign out)

## One quick check before I build
- Domain to use in the SIWE message: I'll default to `window.location.host` (works for preview + custom domain). OK?
- The placeholder email scheme `0xabc...@wallet.monast.io` is internal-only and never shown to users — confirm you're fine with that as a stopgap until Circle/Privy lands.

Reply "go" (with any tweaks) and I'll implement in one pass.