
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop policy if exists "Ad photos are publicly readable" on storage.objects;
create policy "Ad photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'ad-photos' and (storage.foldername(name))[1] is not null);
