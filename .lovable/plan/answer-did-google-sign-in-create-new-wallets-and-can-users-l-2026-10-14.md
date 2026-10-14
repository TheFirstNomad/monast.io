# Answer: did Google sign-in create new wallets, and can users lose funds?

## What happened
- Yes. Since the switch to the live Circle account, a Google sign-in creates a **new live wallet** for that person. That's because Circle's test account and its live account are completely separate. Your live account has never seen those users, so it can't reach their old wallets.
- Their old wallets were on the **test network**. They only ever held test USDC, which has no real value. So nobody loses real money.
- The old test wallets still exist inside Circle's test account. They aren't deleted, just no longer shown in Monast.

## Is this a risk going forward?
No, as long as Monast stays on the live network. From now on, the same Google account always gets back the same live wallet and its balance. A new wallet is only created on someone's very first live sign-in.

It would become a risk only if the Circle account, App ID or network were switched again later. Then users with real funds would get fresh empty wallets. Their money wouldn't disappear, but they couldn't see it in Monast.

## Proposed safeguard (small)
1. When a sign-in brings back a different wallet than the one saved, keep the old address on record instead of replacing it. This way no address is ever lost from the account.
2. Show any older wallet on the Wallet page as "Previous wallet (test network)". Users can still see it, and Monast never uses it for new payments.
3. Add a note to the project rules: never change the live Circle App ID, API key account or wallet network once users hold real funds.

## Technical details
- `circle-social` currently overwrites `profiles.circle_wallet_address/id` (3 places). Before overwriting, insert the old address into `user_wallets` (kind `email_circle`, chain 5042002, not primary) when it differs.
- Wallet page: list non-primary Circle wallets as read-only history.
- Add the rule to AGENTS.md.
