-- Nocta — nights shared to improve the insights (src/lib/research.js).
--
--   nocta_research_nights   one row per account per night: a summary of what
--                           the machine recorded (hours, AHI and events by type,
--                           leak, pressure, breathing rate, settings), the
--                           morning check-in's tags, the insight Nocta showed
--                           (its state and action, not its words) and whether
--                           the person found it helpful. No name, no email, no
--                           event-by-event list or waveforms.
--
-- Accounts share by default and can turn it off (Settings › Share my nights to
-- improve Nocta); turning it off deletes their rows. A guest never shares:
-- their data stays on their device. Deleting the account deletes the rows
-- (on delete cascade).
--
-- Each person can write and remove only their own rows (an upsert needs to
-- read them too). Nobody can read anyone else's from the app; analysis happens
-- in the dashboard / SQL editor.
--
-- "General" is shared with another app, so everything is prefixed nocta.

create table if not exists public.nocta_research_nights (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  night      date        not null,
  data       jsonb       not null check (pg_column_size(data) <= 8192),
  updated_at timestamptz not null default now(),
  primary key (user_id, night)
);

alter table public.nocta_research_nights enable row level security;

revoke all on public.nocta_research_nights from anon, authenticated;
grant select, insert, update, delete on public.nocta_research_nights to authenticated;

drop policy if exists "nocta research: own rows only" on public.nocta_research_nights;
create policy "nocta research: own rows only"
  on public.nocta_research_nights for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
