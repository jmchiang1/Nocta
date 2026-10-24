# Nocta — Sign-in setup (Supabase)

The splash says **Get started** / **I already have an account**. Both lead to the sign up
/ sign in screen:

| Option | What happens |
|---|---|
| Continue with Google | Supabase OAuth in a popup window (`src/lib/authPopup.js`); the page never leaves. Falls back to a full-page redirect if the browser blocks popups. |
| Continue with Microsoft | The same, through Supabase's **Azure** provider. For Outlook / Hotmail / Live accounts as well as work and school ones. |
| Look around without an account | A guest. Nothing is saved, so there's no setup: the medical disclaimer, then the app with sample data. It's a flag on the phone, not a Supabase user. |

**No email + password (removed 2026-10-24).** Supabase's built-in mailer only sends to
members of your Supabase organization, so confirmation and reset emails never reach
anyone else. Bringing it back needs a domain and an email sender (Resend, Postmark…) in
**Authentication › Emails › SMTP Settings**; the screens are in git history (before the
commit that added Microsoft). An email account made before then stays signed in until it
signs out, and Settings shows "Signed in with email".

A new account goes through setup. One that finished setup before skips straight to
Tonight. A guest who wants their own data taps **You › Account › Create an account**.

Code: `src/lib/supabase.js` (client), `src/lib/auth.jsx` (sign-in + the mock). Without
the two env vars in `.env.local`, the app runs on the mock and the DevPanel's
**Sign-in** group decides what each sign-in lands on.

---

## Project: "General" (shared)

Nocta uses the existing Supabase project **General** (`hhkeuxpmcbfkifvhvdxp`), which also
holds another app's tables (`properties`, `floor_plans`, `apollo_app_state`,
`reference_facilities`, `waitlist`). Auth settings are project-wide, so:

- **Users are shared.** Someone who signs up in the other app with Google is the same
  `auth.users` row in Nocta. Nocta's own "finished setup" flag lives in
  `user_metadata.onboarded`. Prefix future Nocta tables (`nocta_…`) or give them their own
  schema.
- **Guest sign-ins (anonymous users) are deliberately not turned on.** Guests are local
  only, so nothing changes for the other app.
- **Moving to Nocta's own project:** the steps are in `docs/SUPABASE_MOVE.md`.

`.env.local` (git-ignored) already holds General's URL and **publishable** key. Never put
the secret / `service_role` key in the app.

## What's left to switch on (dashboard, ~10 minutes)

### 1. Allow Nocta's address as a redirect

Supabase › General › **Authentication › URL Configuration › Redirect URLs**, then add:

- `http://localhost:5180/app/` (dev; the port is set in `vite.config.js`)
- the live app: `https://nocta-sleep.vercel.app/app/`

The app lives at `/app/`; `/` is the marketing site (`index.html`, `src/site/`). Sign-ins
come back to the address the app is on, so the `/app/` addresses are the ones
to allow. An older link that still points at `/` is passed on to `/app/` by `src/site/site.js`.

Don't change the **Site URL**, because it belongs to the other app. If a redirect isn't on
this list, Supabase sends people to the Site URL instead, which means the other app.

### 2. Google

1. Google Cloud console › **Google Auth Platform**: set up the consent screen. Its name
   shows on Google's screen, so if General is shared, pick something neutral or "Nocta".
   Scopes: `openid`, `userinfo.email`, `userinfo.profile`. Ask for nothing more, because
   extra scopes trigger a long Google review.
2. **Clients › Create client › Web application**
   - Authorized JavaScript origins: `http://localhost:5180` and `https://nocta-sleep.vercel.app`
   - Authorized redirect URI: `https://hhkeuxpmcbfkifvhvdxp.supabase.co/auth/v1/callback`
3. Supabase › General › **Authentication › Sign In / Providers › Google**: paste the Client
   ID and Client Secret, then enable it.

### 3. Microsoft (Supabase calls it Azure)

1. [Azure portal](https://portal.azure.com) › **Microsoft Entra ID › App registrations ›
   New registration** (a free Microsoft account is enough).
   - Name: "Nocta" (it shows on Microsoft's sign-in screen).
   - Supported account types: **Accounts in any organizational directory and personal
     Microsoft accounts**. Without "personal", Outlook / Hotmail addresses can't sign in.
   - Redirect URI: platform **Web**, `https://hhkeuxpmcbfkifvhvdxp.supabase.co/auth/v1/callback`
2. **Certificates & secrets › New client secret.** Copy its **Value** (not the Secret ID)
   right away; it's shown once. Secrets expire (24 months at most): put the date in your
   calendar, because sign-in stops working the day it does.
3. Recommended: **Token configuration › Add optional claim › ID › `xms_edov`**, so
   Supabase can tell whether a work account's email domain is verified.
4. Supabase › General › **Authentication › Sign In / Providers › Azure**: paste the
   **Application (client) ID** (from Overview) and the secret Value. Leave **Azure Tenant
   URL** empty (it means "any account"). Enable it.

The app asks for the `email` scope (Microsoft leaves the address out otherwise). Microsoft
shares no profile photo, so those accounts get the neutral avatar. Microsoft's screen says
"unverified" next to the app name until you complete publisher verification (needs a
Microsoft Partner Network ID); people can still sign in.

### 4. Check it works

| Try | Expect |
|---|---|
| Continue with Google, a Google account new to General | Setup starts with "New account for you@…" |
| Finish setup, sign out, Continue with Google again | "Restoring your account…", then Welcome back, with no setup |
| Cancel on Google's screen | Back on the splash, no error |
| Continue with Microsoft, an Outlook / Hotmail account | Setup starts with "New account for you@…" |
| Finish setup, sign out, Continue with Microsoft again | Welcome back, with no setup |
| Cancel on Microsoft's screen | Back on the splash, no error |
| Look around without an account | Disclaimer, then Tonight with sample data |
| As a guest: You › Account › Create an account | The sign-up screen, then setup |

## Delete account (Edge Function)

Settings › Delete account calls the `delete-account` Edge Function
(`supabase/functions/delete-account/`). A browser can't delete its own Supabase user,
so the function checks the caller's session and deletes exactly that user with the
service role key Supabase gives every function (it never ships in the app). Nocta's
own tables (`nocta_wearable_*`) cascade on the user's deletion.

Deployed to "General" on 2026-10-15. To redeploy:

```
supabase functions deploy delete-account --project-ref hhkeuxpmcbfkifvhvdxp --no-verify-jwt --use-api
```

`--no-verify-jwt` because the project uses the new JWT signing keys; the function
verifies the session itself (`auth.getUser`) and answers 401 to anything else.

## Before the App Store

- **Sign in with Apple has to come back.** App Store guideline 4.8: an app that offers
  Google sign-in must also offer Sign in with Apple (or an equivalent privacy-focused
  option). It needs the $99/yr Apple Developer Program: a Services ID with return URL
  `https://<ref>.supabase.co/auth/v1/callback` and a `.p8` key. The Apple secret
  **expires every 6 months**. The code already handles Apple (`signInWith('apple')`, Hide
  My Email display), so it's mostly a button and dashboard work.
- **Native sheets in the iOS build (Capacitor).** Use Google Sign-In / Apple's
  `ASAuthorizationController` → `supabase.auth.signInWithIdToken` instead of the web
  redirect. Google needs an iOS client ID (Web client ID listed first in Supabase) and
  "Skip nonce check".
- **Your own auth domain** (Supabase custom domain) so Google's screen says Nocta rather
  than `hhkeuxpmcbfkifvhvdxp.supabase.co`.
