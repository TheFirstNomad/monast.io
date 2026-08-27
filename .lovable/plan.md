# Confirm the Arc Testnet USDC token ID

## What the lookup found

The Circle wallet holds two USDC entries on Arc Testnet:

| Entry | token.id | Details |
|---|---|---|
| Native USDC | `15dc2b5d-0994-58b0-bf8c-3a0501148ee8` | native gas asset, 18 decimals, no contract address |
| ERC-20 USDC | `ef87c8c3-85de-598a-af50-c5135eecfa74` | contract `0x3600…0000`, 6 decimals |

You chose the **ERC-20** one, which is the right call: every other part of the app (escrow deposit verification, treasury payouts) already uses contract `0x3600…0000` with 6 decimals, so the two paths now agree.

## No code or UI work needed

The transfer function already reads the value from the Edge Function secret at runtime, and only that one place uses it. So there is nothing to build — no settings form, no admin screen.

## The one action item

The secret was previously saved with the value `36b6931a-873a-56a8-8a27-b706b17104ee`, which does not match either entry returned by Circle for this wallet. Left as-is, Circle-wallet payments (fund escrow, publish ad, promote ad) will be rejected by Circle as an unknown token.

Step: update the `CIRCLE_USDC_TOKEN_ID_ARC_TESTNET` secret to:

```
ef87c8c3-85de-598a-af50-c5135eecfa74
```

I will open the secure secret form for you to confirm that value. Self-custody wallet payments are unaffected either way.

## Optional follow-up

After the secret is updated, I can run a live check of the Google sign-in → Circle wallet → escrow funding path and report whether Circle accepts the transfer.
