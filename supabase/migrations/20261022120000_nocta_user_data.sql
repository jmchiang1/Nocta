-- Nocta — each account's data, saved so it follows them to every device
-- (src/lib/cloudSync.js).
--
--   nocta_user_data   one row per kind of data: 'profile' (setup answers,
--                     photo), 'checkins', 'equipment', 'wearable:<provider>',
--                     and 'card' (a small marker; the card itself is a file)
--   nocta-cards       storage bucket: the imported SD card, gzipped JSON, at
--                     <user id>/card.json.gz
--
-- Unlike the wearable tables, the person reads and writes these directly
-- from the app, so RLS policies let each signed-in user touch only their own
-- rows and their own folder. Nothing here is readable by anyone else, and a
-- deleted account takes its rows with it (the delete-account function removes
-- the card file).
--
-- "General" is shared with another app, so everything is prefixed nocta.

create table if not exists public.nocta_user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null check (char_length(key) <= 64),
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.nocta_user_data enable row level security;

revoke all on public.nocta_user_data from anon;
grant select, insert, update, delete on public.nocta_user_data to authenticated;

create policy "nocta_user_data: own rows only"
  on public.nocta_user_data
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- the card file: a private bucket, one folder per user
insert into storage.buckets (id, name, public, file_size_limit)
values ('nocta-cards', 'nocta-cards', false, 52428800)
on conflict (id) do nothing;

create policy "nocta-cards: own folder only (read)"
  on storage.objects for select to authenticated
  using (bucket_id = 'nocta-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "nocta-cards: own folder only (add)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'nocta-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "nocta-cards: own folder only (replace)"
  on storage.objects for update to authenticated
  using (bucket_id = 'nocta-cards' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'nocta-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "nocta-cards: own folder only (remove)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'nocta-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
