# Fix Google sign-in: "Provided app ID is not recognized"

## Cause
The site now uses the live Circle account, but Google sign-in still sends the App ID from the test account. Circle's live account has its own App ID, so it rejects the old one.

## Fix
1. Swap in the live Circle App ID `d97e7f1a-95fa-5b06-850c-c7a2fd40ec19` everywhere the site signs people in with Google and sets up their Circle wallet.
2. Check that the live Circle account accepts the new App ID by testing the sign-in start step.
3. Publish so monast.io gets the fix.

## Your part (in Circle Console, Mainnet tab)
- Under Wallets, then User Controlled, then Configurator, then Social Logins, turn Google on and use the same Google client ID you used before.
- Make sure `https://monast.io/auth` and `https://www.monast.io/auth` are allowed as return addresses for that Google login.

## Note
People who signed in with Google before the switch had wallets on the test network. After this fix, their next Google sign-in creates a new live wallet. Their old test wallets stay on the test network.

## Technical details
- In `src/lib/circle/config.ts`, set `CIRCLE_APP_ID` to the mainnet App ID. Nothing else changes. Wallet sign-in through MetaMask is not touched.
