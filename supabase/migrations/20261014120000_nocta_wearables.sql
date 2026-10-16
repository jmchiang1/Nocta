-- Nocta — wearable connections (Oura, Fitbit via Google Health, Whoop, Withings).
--
-- The provider tokens live here and only here: the nocta-wearables edge
-- function reads and writes them with the service role. RLS is on with no
-- policies, and the browser roles get no grants, so a signed-in user can't
-- read tokens back, not even their own. The app asks the function for
-- status instead.
--
-- "General" is shared with another app, so everything is prefixed nocta_.

create table if not exists public.nocta_wearable_links (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  provider         text        not null check (provider in ('oura', 'fitbit', 'whoop', 'withings')),
  access_token     text        not null,
  refresh_token    text,
  expires_at       timestamptz,
  scope            text,
  provider_user_id text,
  connected_at     timestamptz not null default now(),
  last_sync_at     timestamptz,
  primary key (user_id, provider)
);

-- one row per "Connect" tap: the CSRF state handed to the provider and
-- checked when it redirects back (expires after 15 minutes, see the function)
create table if not exists public.nocta_wearable_states (
  state      text        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  provider   text        not null check (provider in ('oura', 'fitbit', 'whoop', 'withings')),
  return_to  text        not null,
  created_at timestamptz not null default now()
);

alter table public.nocta_wearable_links  enable row level security;
alter table public.nocta_wearable_states enable row level security;

revoke all on public.nocta_wearable_links  from anon, authenticated;
revoke all on public.nocta_wearable_states from anon, authenticated;
