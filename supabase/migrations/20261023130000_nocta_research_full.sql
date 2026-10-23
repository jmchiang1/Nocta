-- Nocta — shared nights in full, and a way to read them with who they belong to.
--
-- nocta_research_nights now holds each night in full (src/lib/research.js):
-- the card's night with its event list and per-minute readings, each
-- wearable's night, the check-in, the insight and its rating. A night like
-- that is tens of KB, so the size limit goes up.
--
-- The nocta_research schema is for reading in the dashboard / SQL editor only.
-- It is not exposed to the app's API (not in the Data API's schemas), and the
-- app's roles get nothing on it. Its views join each sharing account's nights
-- with who they are (email, name, sign-in method, setup answers, equipment,
-- check-ins), and leave out anyone who turned sharing off (profile
-- shareResearch = false). The waveforms around events stay in the account's
-- card file: storage bucket nocta-cards, <user id>/card.json.gz (gzipped JSON,
-- nights[].waves).

alter table public.nocta_research_nights drop constraint if exists nocta_research_nights_data_check;
alter table public.nocta_research_nights
  add constraint nocta_research_nights_data_check check (pg_column_size(data) <= 1048576);

create schema if not exists nocta_research;
revoke all on schema nocta_research from public, anon, authenticated;

-- one row per sharing account: who they are and what they told Nocta
create or replace view nocta_research.people as
select
  u.id                                              as user_id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') as name,
  u.raw_app_meta_data->>'provider'                  as signed_in_with,
  u.created_at                                      as joined_at,
  u.last_sign_in_at,
  p.value->'answers'                                as setup_answers,
  p.value->'checkinReminder'                        as checkin_reminder,
  e.value                                           as equipment,
  c.value                                           as checkins,
  (select count(*) from public.nocta_research_nights r where r.user_id = u.id) as nights_shared
from auth.users u
join public.nocta_user_data p on p.user_id = u.id and p.key = 'profile'
left join public.nocta_user_data e on e.user_id = u.id and e.key = 'equipment'
left join public.nocta_user_data c on c.user_id = u.id and c.key = 'checkins'
where coalesce((p.value->>'shareResearch')::boolean, true);

-- every shared night, with whose it is
create or replace view nocta_research.nights as
select
  r.user_id,
  pe.email,
  pe.name,
  r.night,
  r.data->'cpap'      as cpap,
  r.data->'wearables' as wearables,
  r.data->'checkin'   as checkin,
  r.data->'insight'   as insight,
  r.data->>'rating'   as rating,
  r.updated_at
from public.nocta_research_nights r
join nocta_research.people pe on pe.user_id = r.user_id;

revoke all on all tables in schema nocta_research from public, anon, authenticated;
