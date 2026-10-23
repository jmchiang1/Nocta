# Analytics and feedback

How Nocta learns what people do in the app (PostHog) and what they think of it
(the feedback form). Neither ever carries CPAP data, check-in answers or anything
typed into the app, other than the feedback note itself.

> **If you run PostHog's setup wizard (`npx @posthog/wizard`) again:** it rewrites
> `analytics.js` with PostHog's defaults (autocapture and session recording on,
> email and name sent), and adds AI tracking to `nocta-nox` with the conversation
> included. Check its changes against this page before keeping any of them.

## Usage analytics (PostHog)

Code: `src/lib/analytics.js`. Without a key nothing loads: no PostHog code ships
in the build and `track()` does nothing (a dev server without one just logs that
analytics are off).

### Turn it on

1. Create a project at posthog.com (US cloud).
2. In the project's settings, turn on **Session replay** (Settings › Session replay),
   and **Heatmaps**. Leave **Discard client IP data** off to keep rough location.
3. Copy the **Project API key** (starts with `phc_`). It's public and safe in the browser.
4. Add it to `.env.local` for local runs, and to Vercel (Project › Settings ›
   Environment Variables, Production and Preview) for the live site:
   ```
   VITE_POSTHOG_KEY=phc_…
   # VITE_POSTHOG_HOST=https://us.i.posthog.com   (the default; EU: https://eu.i.posthog.com)
   ```
5. Redeploy. Vite bakes `VITE_` values in at build time, so a new key needs a new build.

The site's Content-Security-Policy (`vercel.json`) allows PostHog's US hosts
(`us.i.posthog.com`, `us-assets.i.posthog.com`). On the EU cloud, change both there too,
or every PostHog request is blocked.

### What's sent

- **Named events**, plus PostHog's autocapture (which element was clicked, never
  its text or attributes: `mask_all_text`, `mask_all_element_attributes`), pageviews
  (path only), heatmaps and dead/rage clicks.
- **Session replay, fully masked.** Every text node and input is masked
  (`maskTextSelector: '*'`, `maskAllInputs`); screen-reader labels, titles and
  `data-*` attributes are masked (`maskAttributeFn`); every chart and graphic (SVG,
  canvas, `role="img"`), the compliance bar and scale, wearable sleep stages and
  outside images (profile photos) are blocked to blank boxes (`blockSelector`). No
  network bodies or headers, no console. Verified by recording a session and
  searching the upload for the night's numbers, check-in answers and text typed to
  Nox (none found). **Anything new that draws someone's data as a shape, colour or
  size** (a bar width, a chart outside SVG/canvas) must be added to `blockSelector`
  or get the class `ph-no-capture`.
- **Location:** IP addresses are kept and used for GeoIP (country and city). Leave
  "Discard client IP data" off in the PostHog project if you want that.
- **Properties come from an allowlist** (`PROPS` in `analytics.js`). Anything else
  is dropped before it leaves the device, so a night's numbers can't be sent even
  by mistake. Every event also carries `app_version` (package version + commit).
- **Crash reports:** uncaught errors and rejected promises (the error and where in
  the code), not the console.
- **Logs:** `appLog.info/error(message, attributes)` sends a fixed message from the
  code to PostHog Logs; attributes go through the same allowlist.
- **AI Nox (`supabase/functions/nocta-nox`, when it's switched on):** PostHog LLM
  analytics in privacy mode: model, tokens, cost, speed and errors per call, never
  the question, the answer or the person's data. Needs `VITE_POSTHOG_KEY` and
  `VITE_POSTHOG_HOST` set as the function's secrets.
- **Who:** an account is identified by its Supabase user id, never its email or name. A
  guest stays anonymous (`person_profiles: 'identified_only'`). Signing out resets.
- **No cookies:** PostHog keeps its id in localStorage.
- **Opt-out:** Settings › Help improve Nocta › Share usage data (shown only when a
  key is set). It's on by default. Turning it off stops capture on that device
  right away and sends nothing about the change. The Privacy Policy
  (`public/privacy.html`, "How you use Nocta") describes all of this; keep the two
  in step.

### Events

| Event | When | Properties |
| --- | --- | --- |
| `app_opened` | Once per visit | `layout` |
| `onboarding_step_viewed` | Each setup step reached, plus `account` and `disclaimer` | `step` |
| `onboarding_completed` | Setup finished | |
| `signed_up` | Email sign-up sent its confirmation email | `method` |
| `signed_in` | An account signed in during this visit (not a restored session) | `method` |
| `guest_started` | "Look around without an account" | |
| `signed_out` | Sign out, or leaving guest mode | |
| `tab_viewed` | Switched tab | `tab` |
| `sheet_opened` | Any sheet or page opened (full night, Nox, metric detail, calendar…) | `sheet` |
| `card_import_started` | SD card files chosen | `files` |
| `card_imported` | Card read and saved | `nights` (how many nights the device now holds) |
| `card_import_failed` | Card couldn't be read | `reason` (error code) |
| `card_removed` | Imported nights removed | |
| `checkin_logged` | Morning check-in saved (never the answers) | `late` |
| `nox_asked` | A question sent to Nox (never the question) | |
| `wearable_connect_started` / `wearable_disconnected` | Wearable connect tapped / disconnected | `provider` |
| `wearable_sync_completed` | User-triggered wearable sync succeeds, including the first sync after connection approval | `provider`, `nights` |
| `insight_rated` | "Was this helpful?" under a night's insight (Tonight) | `rating` (up/down), `state` (the insight's card state), `action` (which tip) |
| `doctor_report_opened` | Doctor summary opened | |
| `data_exported` | Settings › Export my data | |
| `account_deleted` / `device_erased` | Delete account / erase a guest's data | |
| `feedback_sent` / `feedback_failed` | Feedback form | `source` |
| `feedback_prompt_dismissed` | The Tonight card's Not now / Don't ask again | `choice` |
| `research_sharing_on` / `research_sharing_off` | Settings › Share my data to improve Nocta | |
| `fitbit_sharing_on` / `fitbit_sharing_off` | Fitbit page › Let Nocta's makers see my Fitbit data | |
| `analytics_on` | Share usage data turned back on | |

To add an event: call `track('noun_verb', { … })`. Any new property must be added
to `PROPS` with the values it may hold, and to this table.

### Useful PostHog views

- **Funnel:** `app_opened` → `guest_started` or `signed_up` → `card_import_started`
  → `card_imported` → `sheet_opened` (sheet = `fullnight`).
- **Setup drop-off:** `onboarding_step_viewed`, broken down by `step`.
- **Import failures:** `card_import_failed`, broken down by `reason`.

## Feedback

Code: `src/screens/FeedbackSheet.jsx`, `src/components/FeedbackPrompt.jsx`,
`src/lib/feedback.js`. Table: `supabase/migrations/20261022130000_nocta_feedback.sql`
(applied to General).

- **Where people send it:** Settings › Help improve Nocta › Send feedback, any time.
  Also from a card on Tonight (phone and desktop): it appears once someone has
  opened Nocta on 3 different days, then again at most every 14 days. It never
  appears after "Don't ask again".
- **What's kept:** a 1–5 rating and/or a note (up to 2,000 characters), where it was
  sent from (`settings` / `prompt`), the layout, the app version, the time, and the
  account's id (empty for a guest; cleared if the account is deleted).
- **Who can read it:** nobody from the app. `anon` and `authenticated` may only
  insert, and only those columns. `user_id` comes from the session, so it can't be
  faked.
- **Read it:** Supabase › General › Table Editor › `nocta_feedback`, or SQL:
  ```sql
  select created_at, rating, message, source, layout, app_version
  from nocta_feedback order by created_at desc;
  ```
- **Spam:** anyone can insert, guests included, and there's no rate limit. If it gets
  abused, restrict the insert policy to `authenticated`, or put the insert behind an
  edge function with a limit.

## Shared data (research)

Code: `src/lib/research.js`. Migrations: `…_nocta_research_nights.sql`,
`…_nocta_research_full.sql` (both applied to General).

- **Who:** accounts only, **on by default**. Guests and the sample year never share.
  Disclosed at sign-up (AuthScreen `LegalNote`) and in the Privacy Policy ("Sharing your
  data with us"). Off in Settings › Help improve Nocta › Share my data: the choice lives
  in the profile (follows the account), the nightly rows are deleted (retried at the
  next sign-in if that fails), and the research views stop showing that person.
  Deleting the account deletes everything (cascade).
- **Per night** (`public.nocta_research_nights.data`): `cpap` (the card's night in full:
  sessions, AHI, the event list, leak, pressure, breathing rate, SpO₂, settings,
  per-minute series; not the waveform slices), `wearables` (Oura / Whoop / Withings
  nights for that date; **Fitbit only with its own opt-in**, off by default, because
  Google's Limited Use rules need affirmative agreement before people read it: the
  Fitbit page › Help improve Nocta › "Let Nocta's makers see my Fitbit data"
  (`profile.shareFitbit`). Turning it off re-sends the nights without Fitbit and
  deletes Fitbit-only nights), `checkin`, `insight`
  (state, action, escalation, confidence), `rating`. Nights with only wearable data
  are included.
- **Who they are, joined:** schema `nocta_research` (not exposed to the API; no grants
  to the app's roles), for the dashboard / SQL editor:
  - `nocta_research.people`: email, name, sign-in method, joined, setup answers,
    equipment, check-ins, nights shared. Sharing accounts only.
  - `nocta_research.nights`: every shared night with the person's email and name.
- **Waveforms:** in each account's card file, Storage › `nocta-cards` ›
  `<user id>/card.json.gz` (gzipped JSON, `nights[].waves`). Read only for accounts in
  `nocta_research.people`.
- **When:** a few seconds after a card import or pull, a wearable sync, a check-in, a
  rating, or a sign-in. Only nights that changed since this device last sent go up.
- **Examples:**
  ```sql
  -- which tips people find helpful
  select insight->>'action' as tip,
         count(*) filter (where rating = 'up') as helpful,
         count(*) filter (where rating = 'down') as not_helpful
  from nocta_research.nights where rating is not null group by 1 order by 2 desc;

  -- one person's last two weeks
  select night, cpap->'ahi'->>'total' as ahi, cpap->>'hours' as hours, checkin, insight, rating
  from nocta_research.nights where email = 'someone@example.com' order by night desc limit 14;
  ```
- **Legal:** on-by-default collection of health data is what laws like
  Washington's My Health My Data Act and several state privacy laws require opt-in
  consent for. This was a deliberate product decision; get it reviewed before going
  beyond a small test group.
