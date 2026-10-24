# Nocta — moving from "General" to its own Supabase project

Nocta started on the shared project **General** (`hhkeuxpmcbfkifvhvdxp`). This moves it to
a project of its own, so its users, sign-in settings, emails and health data are no longer
mixed with the other app.

**Data:** only test accounts exist, so nothing is copied over. Sign in again on the new
project and re-import the SD card. (Everything Nocta keeps is rebuilt from the
migrations in `supabase/migrations/`, so the schema comes over exactly.)

Commands use the Supabase CLI through `npx supabase …`, run from the repo on your own
computer, after `npx supabase login`. `NEW` below is the new project's ref (the
`xxxx` in `https://xxxx.supabase.co`).

---

## 1. Create the project (dashboard)

supabase.com › your organization (Pro) › **New project**: name **Nocta**, a strong
database password (save it in your password manager), region **East US** (same as
General, close to Vercel's default). Wait for it to finish setting up.

## 2. Tables, storage and research views

**SQL Editor** › paste each file and Run, **in this order** (each one only creates
things; none of them touch what's already there):

1. `supabase/migrations/20261014120000_nocta_wearables.sql`
2. `supabase/migrations/20261016120000_nocta_nox_usage.sql`
3. `supabase/migrations/20261022120000_nocta_user_data.sql` (also makes the private
   `nocta-cards` storage bucket)
4. `supabase/migrations/20261022130000_nocta_feedback.sql`
5. `supabase/migrations/20261023120000_nocta_research_nights.sql`
6. `supabase/migrations/20261023130000_nocta_research_full.sql`

Then check **Table Editor** lists the `nocta_` tables and **Storage** has `nocta-cards`.
Leave **Project Settings › Data API › Exposed schemas** as it is: `nocta_research` must
stay off it.

## 3. Sign-in

**Authentication › URL Configuration**
- **Site URL:** `https://nocta-sleep.vercel.app/app/` (it's Nocta's project now, so this
  can finally point at Nocta)
- **Redirect URLs:** `http://localhost:5180/app/` and `https://nocta-sleep.vercel.app/app/`

**Authentication › Sign In / Providers**
- **Email:** turn it **off**. Nocta doesn't offer email sign-in, and leaving it on would
  let anyone make an account through the API.
- **Google:** paste the same Client ID and Secret as General. Then in Google Cloud ›
  Google Auth Platform › Clients › your web client, **add** the redirect URI
  `https://NEW.supabase.co/auth/v1/callback` (keep the old one until General is retired).
- **Azure (Microsoft):** set up as in `docs/AUTH_SETUP.md` § 3, using
  `https://NEW.supabase.co/auth/v1/callback` as the Redirect URI.

## 4. Edge functions and their secrets

Function secrets can't be read back from General, so get each value again from where it
came from (each company's developer dashboard, the Anthropic console, PostHog). A
company you haven't registered can be left out.

```sh
npx supabase secrets set --project-ref NEW \
  OURA_CLIENT_ID=… OURA_CLIENT_SECRET=… \
  FITBIT_CLIENT_ID=… FITBIT_CLIENT_SECRET=… \
  WHOOP_CLIENT_ID=… WHOOP_CLIENT_SECRET=… \
  WITHINGS_CLIENT_ID=… WITHINGS_CLIENT_SECRET=… \
  NOCTA_APP_ORIGINS=http://localhost:5180,https://nocta-sleep.vercel.app

# only if smart Nox is turned on (docs/NOX_SETUP.md)
npx supabase secrets set --project-ref NEW ANTHROPIC_API_KEY=…

npx supabase functions deploy delete-account  --project-ref NEW --no-verify-jwt --use-api
npx supabase functions deploy nocta-wearables --project-ref NEW --no-verify-jwt --use-api
npx supabase functions deploy nocta-nox       --project-ref NEW --no-verify-jwt --use-api
```

Then at **each wearable company** (Oura, Whoop, Withings, and the Google Cloud client
for Fitbit), add the new callback URL:
`https://NEW.supabase.co/functions/v1/nocta-wearables/callback`

## 5. Point the app at it

- **`.env.local`** (your computer): `VITE_SUPABASE_URL=https://NEW.supabase.co` and the
  new project's **publishable** key (Project Settings › API Keys).
- **Vercel** › nocta-sleep › Settings › Environment Variables: the same two, then
  **Redeploy**.
- **`vercel.json`**: the Content-Security-Policy names the old project
  (`hhkeuxpmcbfkifvhvdxp.supabase.co`, twice). It has to name the new one, or the live
  site can't reach Supabase. (Send Claude the new ref and it updates this file and the
  docs.)

## 6. Check it works

Run through `docs/AUTH_SETUP.md` § 4 on localhost and then on the live site: Google,
Microsoft, setup, sign out and back in, an SD card import, a wearable connect, Send
feedback, and Delete account.

## 7. Afterwards: tidy General

Once the new project has worked for a while, delete Nocta's tables, the `nocta-cards`
bucket, the `nocta_research` schema and the three functions from General, and remove the
old redirect URLs. Check nothing of the other app's uses them first.
