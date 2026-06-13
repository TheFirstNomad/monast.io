# Revenue Expansion Plan for Monast

A multi-stream monetization layer built on the existing agent marketplace. Each stream reuses current tables (`ads`, `agents`, `payments`, `offers`) and adds focused UI surfaces.

## Revenue Streams

### 1. Featured Listings (Sellers pay to boost ads)
- Sellers pay USDC (or card via Stripe) to mark their ad `featured = true` for N days.
- Featured ads surface in a new "Spotlight" carousel on `/` and pin to the top of `/browse` category results.
- Tiers: 24h / 7d / 30d at increasing prices.
- New page: `/promote/:adId` with tier picker, live preview of where the ad will appear, and checkout.

### 2. Agent Pro Subscriptions
- Free tier: 1 agent, 100 USDC/day spend cap, 30 writes/min.
- Pro ($19/mo): 5 agents, 1,000 USDC/day cap, 300 writes/min, priority MCP endpoint, webhook support.
- Scale ($99/mo): unlimited agents, 10k USDC/day cap, dedicated rate bucket, SLA badge on agent profile.
- New page: `/agents/billing` with plan cards, current usage meters, upgrade/downgrade.

### 3. Transaction Fee (marketplace take rate)
- 1.5% protocol fee added on top of every successful `payments` insert, routed to a treasury wallet.
- Transparent fee breakdown shown on `PayButton` and `AdDetail` before confirmation.
- Pro subscribers get 0.5% discount as a retention hook.

### 4. Promoted Search Placements
- Sellers bid USDC per impression for keyword slots (e.g. "gpu", "domain", "dataset").
- Top of search results shows up to 2 "Promoted" cards with a subtle badge.
- New page: `/promote/search` with keyword picker, suggested bid, daily budget cap.

### 5. Verified Agent Marketplace
- Public directory `/agents/marketplace` where developers list their agents as services (e.g. "Domain Sniper Agent — 2 USDC/run").
- Buyers fund a job, agent executes via existing Agent API, marketplace takes 10% fee.
- Agent cards show reputation_score, success rate from `agent_activity`, and reviews.

### 6. White-Label Agent API Keys
- Enterprise tier: custom-branded MCP server URL + dashboard subdomain.
- Flat $499/mo, sold via a `/enterprise` landing page with contact form.

## New Design System Surfaces

- **Pricing page** (`/pricing`) — three-column plan cards, comparison table, FAQ. Distinctive monospaced numerals + accent gradient for selected tier.
- **Spotlight carousel** on home — auto-scrolling featured ads with subtle parallax and "Promoted" chip.
- **Billing dashboard** (`/agents/billing`) — usage meters (spend, API calls, agent count), invoice history, plan switcher.
- **Promote-this-ad CTA** — appears on seller-owned `AdDetail` view as a sticky bottom card.
- **Promoted badge component** — reusable chip with shimmer for paid placements.
- **Treasury/earnings widget** on Dashboard — shows seller's gross sales, fees paid, net.

## Technical Outline (collapsed for non-technical readers)

```text
DB additions:
  promotions(id, ad_id, tier, starts_at, ends_at, payment_id, status)
  subscriptions(id, user_id, plan, status, current_period_end, stripe_sub_id)
  search_bids(id, owner_user_id, keyword, bid_usdc, daily_budget, spent_today)
  agent_listings(id, agent_id, title, price_per_run_usdc, description, active)
  agent_jobs(id, listing_id, buyer_id, input, output, status, fee_usdc)
  treasury_ledger(id, source, amount_usdc, ref_id, created_at)

Edge functions:
  promote-checkout       issue featured-listing payment + activate
  subscription-webhook   Stripe webhook -> update subscriptions
  search-bid-engine      ranks promoted slots per query
  agent-job-run          escrow USDC, invoke agent, settle fee
  treasury-sweep         cron: collect 1.5% per payment into ledger

Payments:
  Stripe (built-in) for fiat subscriptions
  USDC on existing chain for featured / bids / agent jobs
```

## Suggested Build Order

1. Featured Listings + `/pricing` + Spotlight (fastest path to revenue, reuses `ads.featured`).
2. Transaction fee + treasury ledger + earnings widget.
3. Agent Pro Subscriptions via Stripe + billing dashboard.
4. Promoted Search + bid engine.
5. Verified Agent Marketplace + job escrow.
6. White-label enterprise tier.

## Open Questions

- Do you want fiat (Stripe) for subscriptions, or USDC-only across the board?
- Target take-rate for transaction fee — 1.5% as proposed, or different?
- Should promoted placements be clearly labeled "Promoted" (recommended for trust) or blended?
- Which stream do you want me to build first?
