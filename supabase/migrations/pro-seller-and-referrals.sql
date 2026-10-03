-- ============================================================
-- Tier 2 schema additions for monast.io
-- TO APPLY: paste into Supabase Dashboard → SQL Editor → Run
-- Safe to run on existing data — all new tables, no column drops
-- ============================================================

-- 1. Pro Seller subscriptions
-- Tracks active Pro Seller subscriptions (manual renewal, no recurring billing).
create table if not exists public.pro_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan        text not null default 'pro',
  expires_at  timestamptz not null,
  tx_hash     text,
  created_at  timestamptz not null default now(),
  constraint pro_subscriptions_user_id_key unique (user_id)
);

-- RLS: users can read and upsert their own subscription row
alter table public.pro_subscriptions enable row level security;

create policy "pro_subscriptions: read own"
  on public.pro_subscriptions for select
  using (auth.uid() = user_id);

create policy "pro_subscriptions: upsert own"
  on public.pro_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "pro_subscriptions: update own"
  on public.pro_subscriptions for update
  using (auth.uid() = user_id);

-- Index for fast active-subscription lookups
create index if not exists pro_subscriptions_user_expires
  on public.pro_subscriptions (user_id, expires_at);

-- 2. Referrals table
-- One row per referral event (referred user signs up and pays first listing fee).
create table if not exists public.referrals (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references auth.users(id) on delete cascade,
  referred_id    uuid references auth.users(id) on delete set null,
  referral_code  text not null,
  credited       boolean not null default false,
  reward_usdc    numeric(12,6) default 0.10,
  created_at     timestamptz not null default now(),
  credited_at    timestamptz
);

-- RLS: referrers can read their own referral rows
alter table public.referrals enable row level security;

create policy "referrals: read own"
  on public.referrals for select
  using (auth.uid() = referrer_id);

-- Index for referral code lookups (used when a new user signs up)
create index if not exists referrals_code_idx on public.referrals (referral_code);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

-- 3. Verified seller flag on profiles
-- Grants verified badge. Admins set this via AdminRoles or direct SQL.
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists pro_until timestamptz;

-- Index to quickly find all verified sellers
create index if not exists profiles_verified_idx on public.profiles (verified) where verified = true;

-- 4. Grant public read on pro_subscriptions for badge display
-- Allow any authenticated user to check if a seller has an active sub (for badge)
create policy "pro_subscriptions: read active for any user"
  on public.pro_subscriptions for select
  to authenticated
  using (expires_at > now());

-- ============================================================
-- Verify:
-- select count(*) from pro_subscriptions;
-- select count(*) from referrals;
-- select column_name from information_schema.columns where table_name = 'profiles' and column_name in ('verified','pro_until');
-- ============================================================
