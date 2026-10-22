# Analytics and feedback

How Nocta learns what people do in the app (PostHog) and what they think of it
(the feedback form). Neither ever carries CPAP data, check-in answers or anything
typed into the app, other than the feedback note itself.

## Usage analytics (PostHog)

Code: `src/lib/analytics.js`. Without a key nothing loads: no PostHog code ships
in the build and `track()` does nothing.

### Turn it on

1. Create a project at posthog.com (US cloud).
2. In the project's settings, turn on **Discard client IP data**.
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

- **Named events only.** Autocapture, session recording, heatmaps, dead-click
  capture, surveys, feature flags and GeoIP lookup are all off.
- **Properties come from an allowlist** (`PROPS` in `analytics.js`). Anything else
  is dropped before it leaves the device, so a night's numbers can't be sent even
  by mistake. Every event also carries `app_version` (package version + commit).
- **Who:** an account is identified by its Supabase user id, never its email. A
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
| `doctor_report_opened` | Doctor summary opened | |
| `data_exported` | Settings › Export my data | |
| `account_deleted` / `device_erased` | Delete account / erase a guest's data | |
| `feedback_sent` / `feedback_failed` | Feedback form | `source` |
| `feedback_prompt_dismissed` | The Tonight card's Not now / Don't ask again | `choice` |
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
