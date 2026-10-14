# Fix listing fee payment from the Google (Circle) wallet

## Cause
Your 3 USDC arrived and the app sent the payment correctly. Circle refused to send it with this message: "Entity needs to setup paymaster policy in developer console before sending transaction on mainnet."

Google wallets are smart wallets, and Circle pays their network fees through its **Gas Station**. On the test network that works automatically. On the live network you have to switch it on yourself in Circle Console first. Until you do, every payment from a Google wallet fails this way, including listing fees, escrow funding and sends. Payments from MetaMask are not affected.

## Your part (Circle Console, Mainnet tab)
1. Open **Gas Station** in the left menu, then **Policies**.
2. Click **Create policy**, choose network **ARC**, and give it a name like "monast gas".
3. Set daily limits you're comfortable with, for example a max spend per transaction and per day. Circle charges your Circle account for the gas it covers.
4. Save the policy and make sure it shows as **Active**.

## App changes
1. When Circle returns this specific error, show a clear message instead of "Your wallet provider could not complete that request." The message will say that payments are paused while the site owner finishes setup, so users aren't confused.
2. Once you've created the policy, I'll check the payment logs to confirm your 0.15 USDC listing fee goes through.

## Technical details
- `supabase/functions/circle-transfer/index.ts`: map Circle code `155509` to a 503 with a plain-language error. Leave the other error handling as it is.
- No change to network, App ID or wallets, as the project rules require.
