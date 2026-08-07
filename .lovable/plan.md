# Finish treasury setup so monast.io can collect funds

## Where things actually stand (verified just now)

- **Treasury wallets: not created.** The `treasury_wallets` table is empty — zero escrow wallets, zero revenue wallets, on any chain. Every payment path (listing fee, escrow funding, sale fees) refuses to run and shows "the platform treasury is not configured".
- **Circle entity secret: not set.** The backend needs `CIRCLE_ENTITY_SECRET` to sign developer-wallet operations. Only `CIRCLE_API_KEY` is stored today, so wallet creation would fail even if you clicked provision.
- **Escrow smart contract: not deployed, and no deploy code exists.** There is no contract source and no deploy function in the project. Escrow today is the custodial model: buyer funds land in the Circle escrow treasury wallet, and release/refund happen as Circle transfers. The trustless contract is still Phase 2.

So: nothing can collect funds yet, and the contract is not deployed by the Circle dev wallet because there is no contract yet.

## What you do (2 minutes, in the Circle console)

1. In the Circle console, go to Wallets, open the developer-controlled setup and **register an Entity Secret**. Copy the 64-character hex secret and download the recovery file — keep that file safe, it is the only way to recover the wallets.
2. Paste that secret to me here. I store it as a backend secret named `CIRCLE_ENTITY_SECRET` (never in code).

## What I do after that

1. **Store the secret** in backend secrets.
2. **Provision the treasury** on Arc Testnet through the existing owner-only console at `/admin/treasury` (you connect owner wallet `0x13FA…4D7c` and click Provision). This creates two separate Circle developer wallets per chain:
   - escrow wallet — holds buyer funds mid-deal only
   - revenue wallet — holds the 0.15 USDC listing fees and 1% sale fees
   Revenue and escrow funds are never mixed, and the console shows live balances plus current open escrow liability.
3. **Verify end to end on testnet**: post an ad and pay the 0.15 USDC listing fee, fund an escrow, release it, and confirm the seller payout plus the 1% fee sweep land correctly and are recorded in the ledger.
4. **Withdraw check**: pull a small revenue amount to your personal wallet from the console so you know the payout path works.

## Escrow contract (separate step, say the word)

If you also want the trustless contract now, that is its own workstream: fork Circle's audited escrow, add per-ad deal linkage, fee split and auto-release timer, then deploy from an admin button using the same Circle developer wallet as deployer/owner, first on Arc Testnet. Until then the custodial Circle escrow above is what runs — it works and is what your current UI expects.

## Technical notes

- `supabase/functions/_shared/circle-dev.ts` already implements entity-secret RSA encryption, wallet-set creation and balance reads; it throws a clear error while the secret is absent.
- `treasury-provision` reuses an existing wallet set if one is found, and is idempotent per (purpose, chain_id), so re-clicking Provision is safe.
- `getTreasury()` has no fallback address by design: if a wallet is missing, money operations fail loudly instead of sending USDC somewhere unrecoverable. That is why payments are blocked right now.
- Default provisioning chain is Arc Testnet (`5042002`), matching your Sep 16 mainnet cutover plan.
