# Nocta — Wearables setup (Oura, Whoop, Withings)

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

**Fitbit is not included.** Google turns off the Fitbit Web API on October 30,
2026, and Fitbit data moves to the Google Health API, which needs Google to review
the app before the public can use it. It's planned as a follow-up.

---

## 1. Register Nocta with each company (about 15 minutes each)

All three use the same redirect (callback) URL:

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
  WHOOP_CLIENT_ID=… WHOOP_CLIENT_SECRET=… \
  WITHINGS_CLIENT_ID=… WITHINGS_CLIENT_SECRET=… \
  NOCTA_APP_ORIGINS=http://localhost:5180
```

- `NOCTA_APP_ORIGINS`: the addresses the function may send people back to after
  they approve (comma-separated). Add the deployed site's origin when there is one.
  Anything not on this list is refused, so the callback can't be used to redirect
  people to some other site.
- A company you haven't registered yet can be left out. The app shows it as not
  set up, and the other two still work.

## 4. Deploy the function

```sh
supabase functions deploy nocta-wearables --project-ref hhkeuxpmcbfkifvhvdxp --no-verify-jwt
```

`--no-verify-jwt` is required. The company redirects the browser to `/callback`
without a Nocta session, so Supabase's gateway check would reject it. Every other
route checks the person's session itself.

## 5. Check it works

1. `npm run dev`, sign in with a real account (not a guest).
2. You › Add a device › Oura (or Whoop or Withings) › Connect.
3. Approve on the company's page. You land back in Nocta, and it pulls the last
   90 nights.
4. Tonight › "Your body overnight" shows that wearable's data on nights it
   recorded. A wearable night appears only where there's a CPAP night with the
   same date: ResMed's sleep day runs noon to noon and is named for the evening
   it started.

---

## What each company gives Nocta

| | Oura | Whoop | Withings |
|---|---|---|---|
| Heart rate | average, lowest, overnight samples (5 min) | resting only | average, lowest |
| HRV | average (ms) | RMSSD (ms) | — |
| Breathing rate | yes | yes | yes |
| Blood oxygen | nightly average | nightly average (4.0 straps) | — |
| Sleep stages | totals + 5-minute sequence | totals | totals |
| Wake-ups | counted from the stage sequence | disturbances | yes |
| Time to fall asleep | yes | — | yes |

Withings' sleep apnea fields (`apnea_hypopnea_index`, the Withings Sleep Rx index,
breathing-disturbance intensity) are deliberately **not** requested. They're
diagnosis-adjacent, and Nocta's AHI comes from the CPAP card.

Wearable data feeds the "Your body overnight" cards only. The why-card, the
insight engine and doctor escalation still run on the CPAP card, because consumer
wearable SpO₂ isn't medical-grade.

## Limits worth knowing

- **Withings** asks for no more than one pull per person every 10 minutes. The
  function enforces it.
- **Whoop** issues a new refresh token every time one is used. If two syncs race,
  one can fail; the connection is kept and the app offers "Reconnect".
- **Disconnecting** deletes the stored tokens and, for Oura and Whoop, revokes
  them with the company. Withings needs a signed request to revoke, so people
  remove Nocta from the Withings app instead.
