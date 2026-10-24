# Nocta — Switching on the smart Nox (Claude)

Nox ships in two versions:

| | Pre-written Nox (on now) | Smart Nox (built, switched off) |
|---|---|---|
| Who gets it | Everyone | Signed-in accounts (guests keep the pre-written one) |
| Answers from | Replies written ahead of time (`src/data/coach.js`) | Claude (`claude-opus-5-5`) via the `nocta-nox` edge function |
| Data sent anywhere | Nothing | A plain-text summary of the person's data, with each question |
| Code | `src/data/coach.js` | `src/lib/nox.js`, `supabase/functions/nocta-nox/`, `supabase/migrations/20261016120000_nocta_nox_usage.sql` |

The switch is `VITE_NOX_SMART`. While it's unset, nothing in the app mentions a
smarter Nox, and the chat opens with "I'm the basic version of Nox…".

## What the smart Nox does

- The app builds a summary on the device (`buildNoxContext` in `src/lib/nox.js`):
  up to 90 nights (hours, AHI split by type, leak, pressure, check-in tags, wearable
  summary), machine settings, setup answers, equipment dates, and the night or Trends
  view Nox was opened from. About 1,600 tokens. No name or email.
- The function checks the session, caps each person at 25 questions a day
  (`NOX_DAILY_LIMIT`), and streams Claude's answer back. It keeps only the daily
  count (`nocta_nox_usage`), never the questions, answers, or summary.
- Its system prompt carries CLAUDE.md's voice and safety rails (no pressure advice,
  no diagnosis names, no therapy changes, hedged causes, compare with the person's
  usual, escalate centrals / SpO₂ / persistent AHI to the doctor).
- Server-side fallback is on (`fallbacks: "default"`): a declined question is re-run
  on the model Anthropic recommends for that refusal category. If that also declines,
  Nox shows a short polite line.
- Rough cost estimate (not measured): $0.03–0.10 per question.

## Switching it on

1. **Claude API key.** Create one at console.anthropic.com, then set it yourself so it
   never passes through a chat:
   ```sh
   supabase secrets set --project-ref fclzquemptbqdoqnrymo ANTHROPIC_API_KEY=…
   ```
   Optional: `NOX_DAILY_LIMIT=…` (default 25).
2. **Function.** The `nocta_nox_usage` table
   (`supabase/migrations/20261016120000_nocta_nox_usage.sql`) is already on the Nocta
   project, so only the function needs deploying:
   ```sh
   supabase functions deploy nocta-nox --project-ref fclzquemptbqdoqnrymo --no-verify-jwt --use-api
   ```
3. **Privacy policy first.** In `public/privacy.html`, replace the one Nox paragraph
   ("Nox, Nocta's coach, answers from replies written ahead of time…") with the
   section below, add the "Nox" paragraph to "What our servers keep", and add the
   Anthropic bullet to "Who else handles your data". Update the date at the top.
4. **The switch.** Set `VITE_NOX_SMART=1` in `.env.local` (local) and in Vercel's
   Production environment variables, then redeploy.

Then sign in, ask Nox a few questions, and check the replies against the safety rails.

### Privacy policy text to restore

Replaces the single Nox paragraph:

```html
      <h2>When you ask Nox a question</h2>
      <p>
        Without an account, Nox answers from replies written ahead of time, in your browser.
        Nothing is sent anywhere.
      </p>
      <p>
        With an account, Nox uses an AI model from <strong>Anthropic</strong> to answer. When you
        send a question, Nocta builds a summary of your data on your device and sends it with your
        question and the chat so far. The summary covers your recent nights' numbers (hours,
        breathing events, leak, pressure), your check-in tags, your setup answers, your equipment
        dates, and wearable summaries if you've connected one. It does not include your name, your
        email, or minute-by-minute data.
      </p>
      <p>
        Nocta's server passes this to Anthropic and sends the answer back to you. It does not keep
        your questions, the answers, or the summary, only a count of how many questions you've asked
        today, so it can set a daily limit. Anthropic processes the request under its commercial
        terms, which don't allow it to train its models on this data. Chats are not saved: closing
        Nox clears the conversation.
      </p>
```

Under "What our servers keep", after the wearables list:

```html
      <p>
        <strong>Nox.</strong> A count of how many questions you've asked Nox each day. Not the
        questions or the answers.
      </p>
```

Under "Who else handles your data", before Google Fonts:

```html
        <li><strong>Anthropic</strong> runs the AI model behind Nox's answers, if you ask Nox a question with an account.</li>
```
