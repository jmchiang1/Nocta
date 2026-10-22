-- Nocta — feedback people send from the app (src/screens/FeedbackSheet.jsx).
--
--   nocta_feedback   one row per message: a 1–5 rating and/or a note, plus
--                    where it was sent from (Settings or the periodic prompt),
--                    the layout and the app version. Never CPAP data.
--
-- Anyone using Nocta can add a row, guests included, but nobody can read,
-- change or delete rows from the app: there is no select, update or delete
-- grant or policy. Read them in the dashboard (Table Editor › nocta_feedback).
-- user_id is filled in by the database from the session (the app can't set
-- it), stays empty for a guest, and is cleared if the account is deleted, so
-- the feedback outlives the account without pointing at anyone.
--
-- "General" is shared with another app, so everything is prefixed nocta.

create table if not exists public.nocta_feedback (
  id          bigint      generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid        default auth.uid() references auth.users (id) on delete set null,
  rating      smallint    check (rating between 1 and 5),
  message     text        check (char_length(message) <= 2000),
  source      text        not null check (source in ('settings', 'prompt')),
  layout      text        check (layout in ('mobile', 'desktop')),
  app_version text        check (char_length(app_version) <= 40),
  check (rating is not null or char_length(btrim(coalesce(message, ''))) > 0)
);

alter table public.nocta_feedback enable row level security;

-- insert only, and only these columns (id, created_at and user_id come from
-- their defaults)
revoke all on public.nocta_feedback from anon, authenticated;
grant insert (rating, message, source, layout, app_version) on public.nocta_feedback to anon, authenticated;

drop policy if exists "nocta feedback: anyone can send" on public.nocta_feedback;
create policy "nocta feedback: anyone can send"
  on public.nocta_feedback for insert
  to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));
