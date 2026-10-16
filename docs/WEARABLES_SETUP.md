# Nocta — Wearables setup (Oura, Fitbit, Whoop, Withings)

Real wearable data reaches Nocta through one Supabase edge function,
`nocta-wearables`, on the shared project **General** (`hhkeuxpmcbfkifvhvdxp`).
The function holds each company's app secret, sends the person to that company to
approve access, keeps their tokens, and pulls their nights.

| Piece | Where |
|---|---|
| Tables `nocta_wearable_links`, `nocta_wearable_states` | `supabase/migrations/20261014120000_nocta_wearables.sql` |
| Edge function (routes, token storage) | `supabase/functions/nocta-wearables/index.ts` |
| Per-company sign-in + data mapping | `supabase/functions/nocta-wearables/providers.ts` |

Tokens never reach the browser: both tables have row-level security on, no
policies, and no grants for the browser roles. Only the function, with the
service role, can read them.

**Connecting a wearable needs a real Nocta account.** Guests are local-only and
have no Supabase user to attach a connection to.

**Fitbit comes through Google.** Google turns off the Fitbit Web API on
October 30, 2026, and has closed new Fitbit developer sign-ups. Fitbit (and Pixel
Watch) data now comes from the person's Google account through the **Google Health
API**, so connecting Fitbit means signing in with Google. While the Google app is in
Testing, only the test users you list (up to 100) can connect. Before the public can,
Google has to review the app's health-data scopes.

---

## 1. Register Nocta with each company (about 15 minutes each)

All four use the same redirect (callback) URL:

```
https://hhkeuxpmcbfkifvhvdxp.supabase.co/functions/v1/nocta-wearables/callback
```

Each company gives you a **client ID** and a **client secret**. Keep the secret out
of the app and out of git. It goes into Supabase secrets in step 3.

### Oura
1. Sign in at **cloud.ouraring.com/oauth/applications** and create a new application.
2. Redirect URI: the callback URL above.
3. Nocta asks for the scopes `daily` (sleep) and `spo2` (blood oxygen). Oura's
   docs spell the second one two ways (`spo2` and `spo2Daily`), so Nocta asks for
   both and Oura drops the one it doesn't know. After your first connection, check
   that blood oxygen shows up. If it doesn't, the scope name is the first thing to
   check.

**No Oura ring?** Set the secret `OURA_SANDBOX=1`. Connect then skips Oura's sign-in
and comes straight back, and nights come from Oura's sandbox (canned data, no ring or
real token needed). Everything is labeled as test data in the app. The sandbox's
"nights" are only a few minutes long, so the numbers look odd; it's for checking
the flow, not the data. Turn it off before real people connect:
`supabase secrets unset --project-ref hhkeuxpmcbfkifvhvdxp OURA_SANDBOX`, then have
anyone connected through the sandbox disconnect and connect again.

### Fitbit (Google Health API)
Use a **separate Google Cloud project** from the one behind "Continue with Google",
for example "Nocta Health". Health scopes put a project's consent screen through
Google's review, and keeping them apart means sign-in can be published without
waiting for it.

1. **console.cloud.google.com** › new project (Location: No organization, with
   your personal Gmail, to avoid the `org_internal` block you hit with sign-in).
2. **APIs & Services › Library**: search **Google Health API** and enable it.
3. **Google Auth Platform**:
   - Branding: app name "Nocta", support email.
   - Audience: **External**, publishing status **Testing**, add your Gmail (the one
     your Fitbit is linked to) as a test user.
   - Data access: add `googlehealth.sleep.readonly` and
     `googlehealth.health_metrics_and_measurements.readonly`.
   - Clients › Create client › **Web application**, authorized redirect URI: the
     callback URL above.
4. Copy the client ID and secret. They go in as `FITBIT_CLIENT_ID` and
   `FITBIT_CLIENT_SECRET` (step 3), even though they're Google's.
5. Your Fitbit needs to be on a Google account (the Fitbit app moves you over when
   you sign in). That's the account you approve with.

### Whoop
1. Sign in at **developer-dashboard.whoop.com**, create a team if asked, then
   create an app.
2. Redirect URL: the callback URL above.
3. Scopes: `read:sleep`, `read:recovery`, `offline` (`offline` is what lets Nocta
   keep syncing without asking again).

### Withings
1. Sign in at **developer.withings.com** › Developer Dashboard and create an
   application for the public API.
2. Callback URL: the callback URL above.
3. Nocta asks for `user.activity`, which covers sleep.
4. **No Withings device?** Set the secret `WITHINGS_DEMO=1` (step 3). Connecting
   then signs in to Withings' demo account, which has sample nights. Remove it
   before real people connect.

---

## 2. Create the tables

General is shared with another app, so paste the migration into **Supabase ›
General › SQL Editor** instead of running `supabase db push`, which also compares
against the other app's migration history:

```
supabase/migrations/20261014120000_nocta_wearables.sql
```

It only creates the two `nocta_`-prefixed tables. Nothing existing changes.

## 3. Set the secrets

```sh
supabase secrets set --project-ref hhkeuxpmcbfkifvhvdxp \
  OURA_CLIENT_ID=… OURA_CLIENT_SECRET=… \
  FITBIT_CLIENT_ID=… FITBIT_CLIENT_SECRET=… \
  WHOOP_CLIENT_ID=… WHOOP_CLIENT_SECRET=… \
  WITHINGS_CLIENT_ID=… WITHINGS_CLIENT_SECRET=… \
  NOCTA_APP_ORIGINS=http://localhost:5180
```

- `NOCTA_APP_ORIGINS`: the addresses the function may send people back to after
  they approve (comma-separated). Add the deployed site's origin when there is one.
  Anything not on this list is refused, so the callback can't be used to redirect
  people to some other site.
- A company you haven't registered yet can be left out. The app shows it as not
  set up, and the others still work.

## 4. Deploy the function

```sh
supabase functions deploy nocta-wearables --project-ref hhkeuxpmcbfkifvhvdxp --no-verify-jwt
```

`--no-verify-jwt` is required. The company redirects the browser to `/callback`
without a Nocta session, so Supabase's gateway check would reject it. Every other
route checks the person's session itself.

## 5. Check it works

1. `npm run dev`, sign in with a real account (not a guest).
2. You › Wearables › Oura (or Fitbit, Whoop, Withings) › Connect.
3. Approve on the company's page. You land back in Nocta, and it pulls the last
   90 nights.
4. Tonight › "Your body overnight" shows that wearable's data on nights it
   recorded. A wearable night appears only where there's a CPAP night with the
   same date: ResMed's sleep day runs noon to noon and is named for the evening
   it started.

---

## What each company gives Nocta

| | Oura | Fitbit | Whoop | Withings |
|---|---|---|---|---|
| Heart rate | average, lowest, overnight samples (5 min) | average, lowest, resting, overnight 5-min averages | resting only | average, lowest |
| HRV | average (ms) | nightly RMSSD (ms) | RMSSD (ms) | — |
| Breathing rate | yes | nightly average | yes | yes |
| Blood oxygen | nightly average | nightly average (devices with SpO₂) | nightly average (4.0 straps) | — |
| Sleep stages | totals + 5-minute sequence | totals + 5-minute sequence | totals | totals |
| Wake-ups | counted from the stage sequence | counted from the stage sequence | disturbances | yes |
| Time to fall asleep | yes | when Fitbit estimates it | — | yes |

Withings' sleep apnea fields (`apnea_hypopnea_index`, the Withings Sleep Rx index,
breathing-disturbance intensity) are deliberately **not** requested. They're
diagnosis-adjacent, and Nocta's AHI comes from the CPAP card.

Wearable data feeds the "Your body overnight" cards only. The why-card, the
insight engine and doctor escalation still run on the CPAP card, because consumer
wearable SpO₂ isn't medical-grade.

## Limits worth knowing

- **Fitbit** data is filtered to Google's own wearables (Fitbit, Pixel Watch), so
  another app writing sleep into the same Google account can't double a night.
  Fitbit's nightly HRV, SpO₂ and breathing rate are dated the morning the sleep
  ended; Nocta matches them to that night. Google keeps the same refresh token, so
  Fitbit doesn't have Whoop's race.

- **Withings** asks for no more than one pull per person every 10 minutes. The
  function enforces it.
- **Whoop** issues a new refresh token every time one is used. If two syncs race,
  one can fail; the connection is kept and the app offers "Reconnect".
- **Disconnecting** deletes the stored tokens and, for Oura and Whoop, revokes
  them with the company. Withings needs a signed request to revoke, so people
  remove Nocta from the Withings app instead.
