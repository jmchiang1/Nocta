/* Nocta — wearable connections (edge function `nocta-wearables`).
 *
 *   POST /start       { provider, returnTo }  → { url }   send the browser here
 *   GET  /callback    ?code&state  (the provider redirects here, no Nocta token)
 *                     → 302 back to the app with ?wearable=<p>&result=connected|denied|error
 *   POST /status                              → { available, links }
 *   POST /sync        { provider, since? }    → { nights, syncedAt } | { throttled }
 *   POST /disconnect  { provider }            → { ok }
 *
 * Everything except /callback needs the person's Supabase session (the app's
 * supabase.functions.invoke sends it). Provider tokens never leave this
 * function: they're stored in nocta_wearable_links, which the browser can't
 * read. Deploy with --no-verify-jwt, because /callback arrives without a
 * Nocta token; the other routes check the session themselves.
 *
 * Secrets: OURA_ / WHOOP_ / WITHINGS_ CLIENT_ID + CLIENT_SECRET, and
 * NOCTA_APP_ORIGINS (comma-separated origins allowed as returnTo). See
 * docs/WEARABLES_SETUP.md. */
import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { PROVIDERS, ReconnectError, credsFor, isProvider, type ProviderKey, type Tokens } from './providers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const REDIRECT_URI = Deno.env.get('NOCTA_WEARABLE_REDIRECT') ?? `${SUPABASE_URL}/functions/v1/nocta-wearables/callback`;
const ORIGINS = (Deno.env.get('NOCTA_APP_ORIGINS') ?? 'http://localhost:5180')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const STATE_TTL_MS = 15 * 60_000;
const BACKFILL_DAYS = 90;
const MAX_BACKFILL_DAYS = 365;
const WITHINGS_MIN_GAP_MS = 10 * 60_000; // Withings: one pull per 10 min per person

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/* ---- who's asking (every route but /callback) ---- */
async function userFrom(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await db.auth.getUser(jwt);
  return error ? null : data.user;
}

/* ---- a link's access token, refreshed first if it's about to expire ---- */
async function freshToken(userId: string, provider: ProviderKey, link: any) {
  const soon = link.expires_at && Date.parse(link.expires_at) < Date.now() + 60_000;
  if (!soon) return link.access_token as string;
  if (!link.refresh_token) throw new ReconnectError('expired, no refresh token');
  const t = await PROVIDERS[provider].refresh(credsFor(provider)!, link.refresh_token);
  await saveTokens(userId, provider, { ...t, provider_user_id: t.provider_user_id ?? link.provider_user_id });
  return t.access_token;
}

async function saveTokens(userId: string, provider: ProviderKey, t: Tokens) {
  const { error } = await db.from('nocta_wearable_links').upsert({
    user_id: userId,
    provider,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_at,
    scope: t.scope,
    provider_user_id: t.provider_user_id,
  });
  if (error) throw error;
}

/* ---- the provider sends the browser back here ---- */
async function callback(url: URL) {
  const state = url.searchParams.get('state') ?? '';
  const { data: row } = await db.from('nocta_wearable_states').select('*').eq('state', state).maybeSingle();
  if (row) await db.from('nocta_wearable_states').delete().eq('state', state);

  // no matching state: we can't know who this is, so send them home empty-handed
  if (!row || Date.now() - Date.parse(row.created_at) > STATE_TTL_MS || !isProvider(row.provider)) {
    return back(`${ORIGINS[0]}/`, row?.provider ?? 'unknown', 'error');
  }
  const provider = row.provider as ProviderKey;
  if (url.searchParams.get('error')) return back(row.return_to, provider, 'denied');

  const code = url.searchParams.get('code');
  if (!code) return back(row.return_to, provider, 'error');
  try {
    const t = await PROVIDERS[provider].exchange(credsFor(provider)!, code, REDIRECT_URI);
    await saveTokens(row.user_id, provider, t);
    return back(row.return_to, provider, 'connected');
  } catch (e) {
    console.error(`[${provider}] code exchange failed`, e);
    return back(row.return_to, provider, 'error');
  }
}

function back(returnTo: string, provider: string, result: string) {
  const to = new URL(returnTo);
  to.searchParams.set('wearable', provider);
  to.searchParams.set('result', result);
  return new Response(null, { status: 302, headers: { Location: to.toString() } });
}

/* ---- routes that need a signed-in person ---- */
async function start(userId: string, body: any) {
  const { provider, returnTo } = body ?? {};
  if (!isProvider(provider)) return json({ error: 'unknown_provider' }, 400);
  const creds = credsFor(provider);
  if (!creds) return json({ error: 'not_configured' }, 503);

  let origin: string;
  try {
    origin = new URL(returnTo).origin;
  } catch {
    return json({ error: 'bad_return' }, 400);
  }
  if (!ORIGINS.includes(origin)) return json({ error: 'bad_return' }, 400);

  const state = crypto.randomUUID().replaceAll('-', '');
  // clear this person's stale attempts while we're here
  await db
    .from('nocta_wearable_states')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', new Date(Date.now() - STATE_TTL_MS).toISOString());
  const { error } = await db
    .from('nocta_wearable_states')
    .insert({ state, user_id: userId, provider, return_to: returnTo });
  if (error) throw error;
  return json({ url: PROVIDERS[provider].authorizeUrl(creds, REDIRECT_URI, state) });
}

async function status(userId: string) {
  const { data, error } = await db
    .from('nocta_wearable_links')
    .select('provider, connected_at, last_sync_at, scope')
    .eq('user_id', userId);
  if (error) throw error;
  return json({
    available: (Object.keys(PROVIDERS) as ProviderKey[]).filter((p) => credsFor(p)),
    links: data.map((l) => ({
      provider: l.provider,
      connectedAt: l.connected_at,
      lastSyncAt: l.last_sync_at,
      // connected through a sandbox (OURA_SANDBOX): its nights are test data
      ...(l.scope === 'sandbox' ? { test: true } : {}),
    })),
  });
}

async function sync(userId: string, body: any) {
  const { provider, since } = body ?? {};
  if (!isProvider(provider)) return json({ error: 'unknown_provider' }, 400);
  if (!credsFor(provider)) return json({ error: 'not_configured' }, 503);
  const { data: link } = await db
    .from('nocta_wearable_links')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (!link) return json({ error: 'not_connected' }, 404);

  if (provider === 'withings' && link.last_sync_at && Date.now() - Date.parse(link.last_sync_at) < WITHINGS_MIN_GAP_MS) {
    return json({ throttled: true, syncedAt: link.last_sync_at });
  }

  const today = new Date();
  const earliest = addDays(today, -MAX_BACKFILL_DAYS);
  let from = /^\d{4}-\d{2}-\d{2}$/.test(since ?? '') ? new Date(`${since}T00:00:00Z`) : addDays(today, -BACKFILL_DAYS);
  if (from < earliest) from = earliest;
  // a day either side: a night that started yesterday evening ends today
  const range = [ymd(addDays(from, -1)), ymd(addDays(today, 1))] as const;

  try {
    const token = await freshToken(userId, provider, link);
    const nights = await PROVIDERS[provider].nights(token, ...range);
    const syncedAt = new Date().toISOString();
    await db.from('nocta_wearable_links').update({ last_sync_at: syncedAt }).eq('user_id', userId).eq('provider', provider);
    return json({ nights, syncedAt });
  } catch (e) {
    // the link stays: a refresh can lose a race (Whoop rotates refresh
    // tokens), and connecting again simply overwrites it
    if (e instanceof ReconnectError) {
      console.warn(`[${provider}] needs reconnecting`, e.message);
      return json({ error: 'reconnect' }, 409);
    }
    throw e;
  }
}

async function disconnect(userId: string, body: any) {
  const { provider } = body ?? {};
  if (!isProvider(provider)) return json({ error: 'unknown_provider' }, 400);
  const { data: link } = await db
    .from('nocta_wearable_links')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (link) {
    const creds = credsFor(provider);
    // best effort: forgetting the tokens below is what actually disconnects
    if (creds) await PROVIDERS[provider].revoke(creds, link.access_token).catch(() => {});
    await db.from('nocta_wearable_links').delete().eq('user_id', userId).eq('provider', provider);
  }
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop();

  try {
    if (route === 'callback' && req.method === 'GET') return await callback(url);
    if (req.method !== 'POST') return json({ error: 'not_found' }, 404);

    const user = await userFrom(req);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    if (route === 'start') return await start(user.id, body);
    if (route === 'status') return await status(user.id);
    if (route === 'sync') return await sync(user.id, body);
    if (route === 'disconnect') return await disconnect(user.id, body);
    return json({ error: 'not_found' }, 404);
  } catch (e) {
    console.error(`[nocta-wearables] ${route}`, e);
    return json({ error: 'failed' }, 500);
  }
});
