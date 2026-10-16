-- Nocta — how many questions each person has asked Nox today, so the
-- nocta-nox edge function can cap daily use (every question costs money).
--
-- Like the wearable tables: RLS on, no policies, no grants for the browser
-- roles. Only the function (service role) reads and writes it. Nothing about
-- the questions themselves is stored, only the count.

create table if not exists public.nocta_nox_usage (
  user_id uuid    not null references auth.users (id) on delete cascade,
  day     date    not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.nocta_nox_usage enable row level security;
revoke all on public.nocta_nox_usage from anon, authenticated;
