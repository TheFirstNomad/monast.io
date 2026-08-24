# Fix Google (Circle) sign-in failing with "Edge Function returned a non-2xx status code"

## What is actually happening

I reproduced the backend calls and inspected your data. The Google flow itself is fine:

- The device-token step works (Circle returns a valid device token).
- Circle's Google login runs and returns a user token.
- The failure happens in the last step, when the app links your Google email to your account.

Your account `mohamednuux@gmail.com` already has an **older Circle wallet id** stored on the profile
(created back when email sign-in used the code/OTP path). Circle's Social Login always mints a
**different** Circle user id. The server has a safety guard that refuses to continue when the two
ids differ, and returns "This email is already linked to another wallet" — the browser only shows
the generic "Edge Function returned a non-2xx status code".

So this is not a Google or Circle configuration problem. It is a legacy-record collision, and it
will hit every account that ever went through the old email path.

## The fix

1. **Let a social login adopt a stale legacy Circle record.**
   When the stored Circle id has no initialized wallet (the old record was never completed with a
   PIN), the server replaces it with the Circle Social Login id and continues. The safety guard
   stays in place for the real case it was written for: an existing id that *does* own a wallet and
   belongs to a different person's login — that still returns a clear, refusal message.

2. **Show the real reason instead of "non-2xx".**
   Read the error body returned by the function in the browser so any future failure shows text like
   "This email is already linked to another wallet" rather than a generic HTTP message.

3. **Handle an expired device token on the way back from Google.**
   Circle's device token is valid for 10 minutes. If the user lingers on Google's consent screen,
   the stored token is expired when they come back and the login silently stalls. The stored pair
   will be timestamped, discarded when stale, and re-minted so the user simply lands back on a
   working sign-in button instead of an endless spinner.

4. **Clear the stuck loading state.**
   The Google button currently keeps spinning if the SDK callback fires without a user token
   (user closed Google, cancelled, or nothing pending on page load). It will reset and stay usable.

5. **One-time cleanup for your own account** so your next tap goes straight through: clear the stale
   legacy Circle id on the profile that has no wallet attached to it.

## Technical details

- `supabase/functions/circle-social/index.ts`, `complete` action:
  - After verifying the Circle user token, if `profiles.circle_user_id` differs from the social
    Circle id, query Circle for wallets under the stored id. If it has none (stale/never
    initialized), overwrite `circle_user_id` with the social id and proceed. If it has wallets,
    keep returning `409` with the explicit message.
  - Return a machine-readable `code` alongside `error` so the client can map messages.
- `src/components/SignInChoice.tsx`:
  - Unwrap `FunctionsHttpError` (`await fnErr.context.json()`) to surface the server's `error` text
    in the toast.
  - Reset `googleLoading` / `handling` on cancellation or missing user token.
- `src/lib/circle/client.ts`:
  - Store `{ deviceToken, deviceEncryptionKey, mintedAt }` under `monast.circleGoogleDevice`;
    treat entries older than ~8 minutes as absent and re-mint.
- Data cleanup: single update setting `circle_user_id = null` for the profile whose stored Circle id
  owns no wallet.

## Untouched

Self-custody wallet sign-in (SIWE, `useWallet`, Reown AppKit, `@wallet.monast.io` synthetic emails,
`isSelfCustodyEmail`) is not modified.
