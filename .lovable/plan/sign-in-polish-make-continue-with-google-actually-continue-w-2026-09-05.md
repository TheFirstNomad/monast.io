# Sign-in polish: make "Continue with Google" actually continue with Google

## What's wrong today

Confirmed by reading the header and sign-in screen code:

- In the header menu (desktop and mobile), "Continue with Google" only opens the sign-in page. It does not start Google sign-in, so the visitor lands on a page that asks them to choose again — and the page opens on the **Wallet** tab, so the Google button they just clicked isn't even visible.
- The sign-in page's second tab is labelled "Email", but there is no email sign-in behind it — only Google. The label promises something the app doesn't do.
- The wallet path is always preselected, even for someone arriving from the Google option.
- The mobile sign-in list has a single plain "Sign in" link while the buttons below it offer both paths — duplicated, inconsistent entry points.

## What changes

1. **The Google option starts Google.** Choosing "Continue with Google" from the header (desktop or mobile) opens the sign-in page already in Google mode and immediately kicks off the Google flow, showing a "Signing you in..." state. No second choice screen.
2. **Choosing "Connect wallet" from the header** opens the sign-in page in wallet mode and opens the wallet picker, same one-click behaviour.
3. **Honest tab labels.** The second tab becomes "Google" with the Google mark instead of "Email", and the supporting text matches.
4. **Cleaner mobile menu.** Remove the redundant "Sign in" list link so the two clear buttons are the only way in.
5. **Small professional touches on the sign-in screen:** consistent button heights across both tabs, a proper disabled/loading state that can't be double-clicked, and a visible message if Google is cancelled instead of a silently stuck spinner.

## Technical notes

- `src/components/Navbar.tsx`: menu items navigate to `/auth?method=google` / `?method=wallet` instead of a bare `/auth`; drop the duplicate mobile "Sign in" link. No changes to session detection, roles, or admin logic.
- `src/components/SignInChoice.tsx`: read the `method` search param to set initial `mode` and auto-trigger `continueWithGoogle()` / `connect()` exactly once (guarded by a ref so a re-render can't retrigger it); rename the `email` tab presentation to Google; tidy loading/cancel states.
- No backend, Circle, escrow, or auth-logic changes — presentation and routing only. The existing test that asserts both `startGoogleSocialLogin` and `connect()` remain in the sign-in component stays green.
