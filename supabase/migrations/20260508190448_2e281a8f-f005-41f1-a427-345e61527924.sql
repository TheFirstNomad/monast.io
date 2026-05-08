
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  wallet_address text,
  rating numeric default 0,
  total_ads integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Ads
create table public.ads (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  price_usdc numeric not null check (price_usdc >= 0),
  category text not null,
  condition text not null check (condition in ('New','Used','Refurbished')),
  location text not null,
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active','sold','removed')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ads enable row level security;
create policy "Active ads are viewable by everyone" on public.ads for select using (status = 'active' or auth.uid() = seller_id);
create policy "Authenticated users can create ads" on public.ads for insert with check (auth.uid() = seller_id);
create policy "Sellers can update their own ads" on public.ads for update using (auth.uid() = seller_id);
create policy "Sellers can delete their own ads" on public.ads for delete using (auth.uid() = seller_id);

create trigger ads_updated_at before update on public.ads
  for each row execute function public.set_updated_at();
create index ads_category_idx on public.ads(category);
create index ads_seller_idx on public.ads(seller_id);
create index ads_created_idx on public.ads(created_at desc);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid references public.ads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "Users can view their messages" on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Users can send messages" on public.messages for insert
  with check (auth.uid() = sender_id);
create policy "Recipients can mark as read" on public.messages for update
  using (auth.uid() = recipient_id);
create index messages_ad_idx on public.messages(ad_id);

-- Offers
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount_usdc numeric not null check (amount_usdc > 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.offers enable row level security;
create policy "Buyer and seller can view offers" on public.offers for select
  using (auth.uid() = buyer_id or auth.uid() in (select seller_id from public.ads where id = ad_id));
create policy "Buyers can create offers" on public.offers for insert
  with check (auth.uid() = buyer_id);
create policy "Buyer or seller can update offer" on public.offers for update
  using (auth.uid() = buyer_id or auth.uid() in (select seller_id from public.ads where id = ad_id));
create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.ads;
alter table public.messages replica identity full;
alter table public.ads replica identity full;

-- Storage bucket for ad photos
insert into storage.buckets (id, name, public) values ('ad-photos','ad-photos', true);
create policy "Ad photos are publicly readable" on storage.objects for select
  using (bucket_id = 'ad-photos');
create policy "Authenticated users can upload ad photos" on storage.objects for insert
  with check (bucket_id = 'ad-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can update their own ad photos" on storage.objects for update
  using (bucket_id = 'ad-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their own ad photos" on storage.objects for delete
  using (bucket_id = 'ad-photos' and auth.uid()::text = (storage.foldername(name))[1]);
