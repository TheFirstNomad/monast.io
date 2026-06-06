# Make monast.io an Agent-Native Marketplace

Based on your answers: agents act as **buyers, sellers, on-behalf-of humans, and as standalone wallet accounts**, primary surface is **MCP**, abuse control is a **stake + reputation + rate-limit combo**, and the first release is an **Agent API + docs site**. The plan ships that first milestone now and lays the rails for MCP + stake/reputation in the next round.

## What ships in this round

1. **Agent identity layer** — every agent gets a row, an API key, a human owner (optional), and a wallet. Standalone agents own their own wallet; delegated agents inherit one from a human.
2. **REST Agent API** (Supabase edge functions) — read-only browse + write actions (offer, accept, pay, message), all authed by agent API key.
3. **Docs site** at `/agents` inside the app — overview, auth, endpoints, code samples, `agents.txt` + OpenAPI spec.
4. **Abuse rails (lightweight)** — per-agent rate limits using the existing `agent_rate_limits` table, plus a `reputation_score` column on agents that increments on successful trades.
5. **Machine-readable hooks** — `/llms.txt`, `/agents.txt`, JSON-LD Product schema on ad pages, and a public `/api/agents/openapi.json`.

Out of scope this round (queued for next round): full MCP server, staking/slashing contract, on-chain intents.

## User-visible changes

- New "Agents" tab in the dashboard: create agent, copy API key, set spend cap, pause/kill switch, view activity log.
- New public `/agents` docs route with quickstart, endpoint reference, and code samples (curl + TypeScript + Python).
- Ad pages get JSON-LD + an "Agent-friendly" badge.
- `/llms.txt` and `/agents.txt` served from the site root.

## Endpoints (v1)

All under `/functions/v1/agent-api/*`, authed via `Authorization: Bearer <agent_api_key>`.

```text
GET  /ads                    list/search active ads
GET  /ads/:id                full ad detail + seller reputation
POST /offers                 create offer (buyer agents)
GET  /offers                 list offers I'm party to
POST /offers/:id/accept      seller agent accepts
POST /offers/:id/cancel      buyer agent cancels
POST /payments               submit on-chain tx_hash for verification
GET  /messages               list my threads
POST /messages               send message
GET  /me                     agent profile + reputation + remaining quota
```

Responses are JSON; pagination via `?cursor`. OpenAPI spec auto-generated at `/api/agents/openapi.json`.

## Trust & safety (this round)

- **Rate limits**: per-agent quotas tracked in `agent_rate_limits` (already exists). Defaults: 600 reads/min, 30 writes/min, 5 offers/min/ad.
- **Spend cap**: each agent has `max_spend_usdc_per_day`; the offer/payment endpoint refuses if today's accepted volume + new amount exceeds it.
- **Owner kill switch**: `agents.status = paused|revoked` blocks all calls.
- **Reputation**: `agents.reputation_score` starts at 0, +1 per completed payment, -5 per cancelled-after-accept. Exposed in `GET /me` and on ad listings the agent sees.
- Staking/slashing is left as a follow-up (needs a Monad contract).

## Technical Details

### Database (new migration)

```sql
-- Agents
create type public.agent_kind as enum ('delegated', 'standalone');
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade, -- null for standalone
  kind public.agent_kind not null,
  display_name text not null,
  wallet_address text not null,                    -- standalone: own wallet; delegated: owner's
  api_key_hash text not null unique,               -- store sha256(api_key), never raw
  api_key_prefix text not null,                    -- first 8 chars for UI display
  status text not null default 'active',           -- active | paused | revoked
  max_spend_usdc_per_day numeric not null default 100,
  reputation_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.agents to authenticated;
grant all on public.agents to service_role;
alter table public.agents enable row level security;
create policy "Owners read their agents"   on public.agents for select using (auth.uid() = owner_user_id);
create policy "Owners insert their agents" on public.agents for insert with check (auth.uid() = owner_user_id);
create policy "Owners update their agents" on public.agents for update using (auth.uid() = owner_user_id);
-- standalone agents (owner_user_id null) are managed exclusively by service_role / agent-api function

-- Activity log for the dashboard
create table public.agent_activity (
  id bigserial primary key,
  agent_id uuid not null references public.agents(id) on delete cascade,
  endpoint text not null,
  status_code int not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
grant select on public.agent_activity to authenticated;
grant all on public.agent_activity to service_role;
alter table public.agent_activity enable row level security;
create policy "Owners read their agent activity" on public.agent_activity for select
  using (exists (select 1 from public.agents a where a.id = agent_id and a.owner_user_id = auth.uid()));
```

Reuse existing `agent_rate_limits` for per-agent throttling (key = `agent:<id>:<endpoint>`).

### Edge functions

- `agent-key-issue` — authed user creates an agent, returns API key once (plain). Server hashes + stores.
- `agent-api` — single function with internal router for the endpoints above; verifies API key → loads agent → checks status, rate limit, spend cap → executes action using `service_role` client scoped to that agent's wallet/owner.
- `agent-openapi` — returns OpenAPI 3.1 JSON spec for `/agents` endpoints.

All write paths reuse existing RLS-safe tables (`offers`, `payments`, `messages`) and impersonate the owner user (or operate as the standalone agent's wallet user) via service-role + explicit `seller_id`/`buyer_id` arguments matching the agent.

### Frontend

- `src/pages/Agents.tsx` — list/create/pause agents, show API key once on creation, copy button, daily-spend slider, activity table.
- `src/pages/AgentDocs.tsx` (route `/agents`) — overview, auth, full endpoint reference rendered from the same OpenAPI JSON, code samples in tabs (curl / TS / Python).
- `public/llms.txt`, `public/agents.txt` — machine-readable site map + agent terms.
- Ad detail page: inject JSON-LD `Product` schema + small "Agent-friendly" badge.

### Files touched
- `supabase/migrations/<new>.sql`
- `supabase/functions/agent-api/index.ts` (new)
- `supabase/functions/agent-key-issue/index.ts` (new)
- `supabase/functions/agent-openapi/index.ts` (new)
- `src/pages/Agents.tsx` (new) and route added in `src/App.tsx`
- `src/pages/AgentDocs.tsx` (new) at `/agents`
- `src/components/Navbar.tsx` — add Agents link for signed-in users
- `src/pages/AdDetail.tsx` — JSON-LD injection + badge
- `public/llms.txt`, `public/agents.txt`

## Follow-up rounds (queued, not built now)

- **Round 2 — MCP server**: wrap the Agent API as MCP tools (mcp-lite on an edge function) so Claude/ChatGPT/Cursor agents can plug in with one URL.
- **Round 3 — Stake/slash**: Monad contract for agent bonds + slashing on disputed payments; reputation moves on-chain.
- **Round 4 — On-chain intents**: signed buy-intents posted to a mempool that solvers fulfill.
