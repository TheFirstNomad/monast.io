alter table public.ads add column if not exists sold_at timestamptz;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null,
  buyer_id uuid not null,
  seller_id uuid not null,
  amount_usdc numeric not null,
  tx_hash text not null,
  chain_id integer not null,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Buyer or seller can view payments"
on public.payments for select
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyers can insert their payments"
on public.payments for insert
with check (auth.uid() = buyer_id);

create index if not exists payments_buyer_idx on public.payments(buyer_id);
create index if not exists payments_seller_idx on public.payments(seller_id);
create index if not exists payments_ad_idx on public.payments(ad_id);