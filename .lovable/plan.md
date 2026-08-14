# monast.io as an open market for humans and AI agents

Goal: any AI agent with its own funded USDC wallet can register, list, buy and sell alongside human users, with every transaction running through the same escrow and the same fees. Monast earns on every listing and every completed sale, regardless of whether the counterparty is a person or a bot.

This matches where Circle is pointing with the open agentic economy: agents are a new form of labor, published as easily as a website, discovered on merit, and paid for work performed. The paid-work part is where monast already has the hard piece built (on-chain verified USDC escrow on Arc); what's missing is letting agents drive it.

## What already exists and works

- Agent API (`agent-api`) with API-key auth, per-agent read/write rate limits, spend caps, and an activity log.
- MCP server exposing 10 tools so Claude/ChatGPT-style clients can call the marketplace.
- Delegated agent key issuance (owner-created agents) and an OpenAPI spec.
- Full human escrow loop: create, fund with on-chain verification, mark delivered, auto-release timer, release, refund, dispute, payout with idempotency.
- Fee mechanics: 0.15 USDC listing fee, 1% sale fee, treasury and revenue wallets, 72h delivery window, all stored in `fee_settings`.
- `agents.txt`, JSON-LD, and machine-readable discovery entry points.

## What is missing

1. **No standalone agent path.** Every agent must be created by a signed-in human. An autonomous agent that owns a wallet cannot onboard itself, and almost every agent-API branch dead-ends with "standalone agents cannot ...".
2. **Agents cannot use escrow at all.** The agent API's only money path is `/payments`, which records a raw wallet-to-wallet transfer and flips the ad to sold. That bypasses escrow entirely and collects no sale fee. It's both the revenue hole and the trust hole.
3. **Agents cannot sell.** No way for an agent to post a listing, so no agent-as-labor side of the market and no listing-fee revenue from agents.
4. **`agents` table is writable by clients.** `authenticated` still holds INSERT/UPDATE on it, with policies to match. Confirmed live. Spend caps and status are the security boundary for agent money, so they must be service-role only.
5. **Reputation is tied to the endpoint being removed** and would silently stop updating.
6. **Agent surface is hidden and stale.** Agent management UI is unrouted, docs still advertise `/payments`, and MCP instructions still say "USDC on Monad" instead of Arc.

## What gets built

### Phase 1: lock down and open up onboarding
- Migration: revoke client INSERT/UPDATE on `agents`, drop the owner insert/update policies, keep owner read. Add `owner_wallet_address` plus a lookup index.
- New `agent-manage` function (service-role, owner-checked) so an owner can pause or revoke their own agent now that direct writes are gone.
- New `agent-register-standalone` function: an agent proves wallet control with a signature over a fresh, address-bound message, gets a backing profile created if needed, and receives an API key once. Registration is free; monetization happens on listings and sales. Repeat calls for the same wallet return the existing agent instead of duplicating.

### Phase 2: one escrow engine, two front doors
- New `_shared/escrow-actions.ts` holding `createEscrowForBuyer`, `confirmEscrowFunded`, `markEscrowDelivered`.
- Refactor `escrow-create`, `escrow-confirm-funded`, and the `mark_delivered` branch of `escrow-cancel` to call it, preserving current behavior and notifications exactly. Verify the human loop end to end on Arc testnet before the agent side is wired.

### Phase 3: agents transact
- Remove `/payments` from the agent API and `submit_payment` from MCP. No agent money moves outside escrow.
- Agent as buyer: `POST /escrows` (spend-cap checked against the ad price) and `POST /escrows/:id/confirm-funded`.
- Agent as seller: `POST /ads`, gated on a verified 0.15 USDC listing-fee transfer to the revenue treasury from the agent's own wallet, and `POST /escrows/:id/deliver`.
- Add `POST /escrows/:id/release` so an agent buyer can confirm receipt early; otherwise the existing auto-release timer completes the sale.
- Mirror all of these as MCP tools.
- Move the reputation increment into `escrow-release`, after payout succeeds, so it credits real completed work for both humans and agents.
- Change agent daily spend accounting to sum escrows instead of the removed payments table.

### Phase 4: make it discoverable and honest
- Update the OpenAPI spec and the agent docs page: standalone registration is free, everything settles through escrow, agents pay the same listing and sale fees humans do.
- Fix the MCP server description (Arc, not Monad) and its suggested tool flow.
- Route the agent management page for signed-in owners, and surface agent listings in browse the same as human listings so the two sides of the market actually meet.
- Update `agents.txt` and the JSON-LD with the new endpoints.

## Deliberately out of scope

Nanopayments / x402 metering, Circle Agent Wallets, delegated-agent revamp, swaps, ERC-8004 identity registries, and agent-initiated disputes. Agent sellers get the happy path plus release; disputes stay human-mediated for now.

## Technical notes

- The attached plan reads the delivery window as `fee_settings.delivery_window_hours`, but `fee_settings` is a key/value table. The real read is the `delivery_window_hours` key, with the `DELIVERY_WINDOW_HOURS` constant as fallback.
- Registration signature checking follows the freshness and address-binding discipline already used in `siwe-verify`, so a replayed signature can't mint a second key.
- The listing-fee check reuses `verifyUsdcTransfer` with `expectedFrom` set to the agent wallet, so an agent can't reuse someone else's fee payment.
- `escrows` stays server-write-only; agents reach it exclusively through service-role functions.
- After the changes, ads created by agents are ordinary rows with `status = 'active'`, so existing RLS, browse queries, and payout logic apply unchanged.

## Verification before calling it done

One real loop on Arc testnet: register a standalone agent, have it post an ad paying the real listing fee (confirm a wrong amount is rejected first), buy it from a second wallet through escrow, mark delivered, release, and confirm the seller received funds minus the sale fee and that reputation incremented.
