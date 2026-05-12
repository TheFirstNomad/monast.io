create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null,
  seller_id uuid not null,
  buyer_id uuid not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(ad_id, buyer_id)
);
alter table public.reviews enable row level security;
create policy "Reviews are viewable by everyone" on public.reviews for select using (true);
create policy "Buyers can create reviews" on public.reviews for insert with check (auth.uid() = buyer_id);
create policy "Buyers can update own reviews" on public.reviews for update using (auth.uid() = buyer_id);
create policy "Buyers can delete own reviews" on public.reviews for delete using (auth.uid() = buyer_id);

create or replace function public.update_seller_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set rating = (
    select coalesce(avg(rating)::numeric(3,2), 0) from public.reviews where seller_id = new.seller_id
  ) where id = new.seller_id;
  return new;
end; $$;
create trigger reviews_update_rating after insert or update or delete on public.reviews
for each row execute function public.update_seller_rating();