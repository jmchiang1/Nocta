/* Nocta — wearable providers. Each one knows its OAuth endpoints, how to trade
 * a code (or a refresh token) for tokens, and how to turn its sleep records
 * into Nocta's night shape:
 *
 *   {
 *     date        'YYYY-MM-DD'  the evening the night started — ResMed's sleep
 *                               day, so it lines up with the CPAP card's night
 *     start, end  'YYYY-MM-DDTHH:MM'  the wearer's wall clock
 *     inBedHours, asleepHours
 *     hr          { avg, low, resting, series } | null   bpm; series = overnight samples
 *     hrv         ms (RMSSD) | null
 *     respRate    breaths/min | null
 *     spo2        average % | null
 *     stages      { deep, rem, light, awake } hours | null
 *     phases      ['deep'|'light'|'rem'|'awake', …] every 5 min | null
 *     awakenings, latencyMin
 *   }
 *
 * Only what the provider measured is filled in; the rest stays null. Nothing
 * here scores, labels, or judges a number. */

export type Tokens = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null; // ISO
  scope: string | null;
  provider_user_id: string | null;
};

export type Night = {
  date: string;
  start: string;
  end: string;
  inBedHours: number;
  asleepHours: number | null;
  hr: { avg: number | null; low: number | null; resting: number | null; series: number[] | null } | null;
  hrv: number | null;
  respRate: number | null;
  spo2: number | null;
  stages: { deep: number; rem: number; light: number; awake: number } | null;
  phases: string[] | null;
  awakenings: number | null;
  latencyMin: number | null;
};

/* the provider said the grant is gone (revoked, expired): the person has to
 * connect again. Anything else is a plain Error. */
export class ReconnectError extends Error {}

type Creds = { clientId: string; clientSecret: string };

/* ---------------------------------------------------------------- helpers */

const round1 = (x: number) => Math.round(x * 10) / 10;
const hrs = (sec: number | null | undefined) => (sec == null ? null : round1(sec / 3600));
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/* '2026-10-13T23:10:00-07:00' → '2026-10-13T23:10' (already local) */
const wall = (iso: string) => iso.slice(0, 16);

/* a UTC instant + '-07:00' → that wall clock */
function shiftWall(utcIso: string, offset: string) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset ?? '');
  const mins = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(Date.parse(utcIso) + mins * 60_000).toISOString().slice(0, 16);
}

/* unix seconds + 'Europe/Paris' → that wall clock */
function zoneWall(epochSec: number, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(epochSec * 1000));
  } catch {
    return new Date(epochSec * 1000).toISOString().slice(0, 16); // unknown zone: UTC
  }
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/* ResMed's sleep day runs noon to noon, named for the evening it starts:
 * bed at 00:40 on the 14th is the night of the 13th */
export function sleepDay(wallClock: string) {
  const date = wallClock.slice(0, 10);
  if (Number(wallClock.slice(11, 13)) >= 12) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* a nap isn't a night: under this much time in bed, a record never stands in
 * for a CPAP night (it would otherwise be the only record on its sleep day) */
const MIN_NIGHT_HOURS = 2;

/* one night per sleep day: the longest time in bed wins */
function longestPerDay(nights: Night[]) {
  const best = new Map<string, Night>();
  for (const n of nights) {
    if (n.inBedHours < MIN_NIGHT_HOURS) continue;
    const cur = best.get(n.date);
    if (!cur || n.inBedHours > cur.inBedHours) best.set(n.date, n);
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

/* standard OAuth2 token call (Oura, Whoop): form body, client secret in it */
async function oauthToken(url: string, form: Record<string, string>): Promise<Tokens> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form),
  });
  const body = await readJson(res);
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) throw new ReconnectError(`token ${res.status}: ${JSON.stringify(body)}`);
    throw new Error(`token ${res.status}: ${JSON.stringify(body)}`);
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? form.refresh_token ?? null,
    expires_at: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
    scope: body.scope ?? null,
    provider_user_id: null,
  };
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new ReconnectError(`${url} ${res.status}`);
  if (!res.ok) throw new Error(`${url} ${res.status}: ${JSON.stringify(await readJson(res))}`);
  return res.json();
}

/* ------------------------------------------------------------------- Oura */
/* API v2. sleep documents carry the overnight heart-rate samples (5 min),
 * HRV, breathing rate and a 5-minute stage string; SpO₂ is a separate daily
 * average keyed by Oura's own `day`. */

const OURA_PHASE: Record<string, string> = { '1': 'deep', '2': 'light', '3': 'rem', '4': 'awake' };

/* wake-ups = runs of "awake" between falling asleep and the final wake */
function awakeningsFrom(phases: string[]) {
  const first = phases.findIndex((p) => p !== 'awake');
  const last = phases.findLastIndex((p) => p !== 'awake');
  if (first < 0) return 0;
  let count = 0;
  for (let i = first + 1; i <= last; i++) {
    if (phases[i] === 'awake' && phases[i - 1] !== 'awake') count++;
  }
  return count;
}

async function ouraPages(path: string, token: string, from: string, to: string) {
  const out: any[] = [];
  let next: string | null = null;
  do {
    const q = new URLSearchParams({ start_date: from, end_date: to });
    if (next) q.set('next_token', next);
    const body = await getJson(`https://api.ouraring.com/v2/usercollection/${path}?${q}`, token);
    out.push(...(body.data ?? []));
    next = body.next_token ?? null;
  } while (next);
  return out;
}

const oura = {
  // Oura's docs list the SpO₂ scope as both `spo2` and `spo2Daily`; an unknown
  // scope is dropped from the consent screen rather than refused, so ask for both
  scope: 'daily spo2 spo2Daily',
  authorizeUrl(c: Creds, redirectUri: string, state: string) {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: c.clientId,
      redirect_uri: redirectUri,
      scope: this.scope,
      state,
    });
    return `https://cloud.ouraring.com/oauth/authorize?${q}`;
  },
  exchange: (c: Creds, code: string, redirectUri: string) =>
    oauthToken('https://api.ouraring.com/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  refresh: (c: Creds, refreshToken: string) =>
    oauthToken('https://api.ouraring.com/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  async revoke(_c: Creds, token: string) {
    await fetch(`https://api.ouraring.com/oauth/revoke?access_token=${encodeURIComponent(token)}`);
  },
  async nights(token: string, from: string, to: string): Promise<Night[]> {
    const [sleeps, spo2Days] = await Promise.all([
      ouraPages('sleep', token, from, to),
      // a missing SpO₂ scope (or a ring without it) shouldn't sink the sync
      ouraPages('daily_spo2', token, from, to).catch(() => []),
    ]);
    const spo2ByDay = new Map(spo2Days.map((d: any) => [d.day, num(d.spo2_percentage?.average)]));

    const nights = sleeps
      .filter((s: any) => s.type === 'long_sleep' || s.type === 'sleep')
      .map((s: any): Night => {
        const start = wall(s.bedtime_start);
        const phases = s.sleep_phase_5_min ? [...s.sleep_phase_5_min].map((d: string) => OURA_PHASE[d] ?? 'light') : null;
        const series = (s.heart_rate?.items ?? []).filter((v: unknown) => num(v) != null);
        const stages =
          s.deep_sleep_duration != null
            ? {
                deep: hrs(s.deep_sleep_duration)!,
                rem: hrs(s.rem_sleep_duration) ?? 0,
                light: hrs(s.light_sleep_duration) ?? 0,
                awake: hrs(s.awake_time) ?? 0,
              }
            : null;
        return {
          date: sleepDay(start),
          start,
          end: wall(s.bedtime_end),
          inBedHours: hrs(s.time_in_bed) ?? 0,
          asleepHours: hrs(s.total_sleep_duration),
          hr:
            s.average_heart_rate != null || series.length
              ? {
                  avg: num(s.average_heart_rate) != null ? Math.round(s.average_heart_rate) : null,
                  low: num(s.lowest_heart_rate),
                  resting: null,
                  series: series.length > 3 ? series : null,
                }
              : null,
          hrv: num(s.average_hrv),
          respRate: num(s.average_breath) != null ? round1(s.average_breath) : null,
          spo2: spo2ByDay.get(s.day) != null ? round1(spo2ByDay.get(s.day)!) : null,
          stages,
          phases,
          awakenings: phases ? awakeningsFrom(phases) : null,
          latencyMin: s.latency != null ? Math.round(s.latency / 60) : null,
        };
      });
    return longestPerDay(nights);
  },
};

/* ------------------------------------------------------------------ Whoop */
/* API v2. A sleep record has stage totals, disturbances and breathing rate;
 * its recovery (joined by sleep_id) has resting HR, HRV and SpO₂. Whoop
 * doesn't share overnight heart-rate samples. */

async function whoopPages(path: string, token: string, from: string, to: string) {
  const out: any[] = [];
  let next: string | null = null;
  do {
    const q = new URLSearchParams({ start: `${from}T00:00:00.000Z`, end: `${to}T00:00:00.000Z`, limit: '25' });
    if (next) q.set('nextToken', next);
    const body = await getJson(`https://api.prod.whoop.com/developer/v2/${path}?${q}`, token);
    out.push(...(body.records ?? []));
    next = body.next_token ?? null;
  } while (next);
  return out;
}

const whoop = {
  scope: 'offline read:sleep read:recovery',
  authorizeUrl(c: Creds, redirectUri: string, state: string) {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: c.clientId,
      redirect_uri: redirectUri,
      scope: this.scope,
      state,
    });
    return `https://api.prod.whoop.com/oauth/oauth2/auth?${q}`;
  },
  exchange: (c: Creds, code: string, redirectUri: string) =>
    oauthToken('https://api.prod.whoop.com/oauth/oauth2/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  // refresh tokens rotate: the new one comes back and must replace the old
  refresh: (c: Creds, refreshToken: string) =>
    oauthToken('https://api.prod.whoop.com/oauth/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      scope: 'offline',
    }),
  async revoke(_c: Creds, token: string) {
    await fetch('https://api.prod.whoop.com/developer/v2/user/access', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  async nights(token: string, from: string, to: string): Promise<Night[]> {
    const [sleeps, recoveries] = await Promise.all([
      whoopPages('activity/sleep', token, from, to),
      whoopPages('recovery', token, from, to),
    ]);
    const recBySleep = new Map(recoveries.filter((r: any) => r.score_state === 'SCORED').map((r: any) => [r.sleep_id, r.score]));

    const nights = sleeps
      .filter((s: any) => !s.nap && s.score_state === 'SCORED' && s.score?.stage_summary)
      .map((s: any): Night => {
        const start = shiftWall(s.start, s.timezone_offset);
        const st = s.score.stage_summary;
        const rec: any = recBySleep.get(s.id) ?? {};
        const ms = (x: number) => round1(x / 3_600_000);
        const deep = ms(st.total_slow_wave_sleep_time_milli);
        const rem = ms(st.total_rem_sleep_time_milli);
        const light = ms(st.total_light_sleep_time_milli);
        return {
          date: sleepDay(start),
          start,
          end: shiftWall(s.end, s.timezone_offset),
          inBedHours: ms(st.total_in_bed_time_milli),
          asleepHours: round1(deep + rem + light),
          hr: num(rec.resting_heart_rate) != null ? { avg: null, low: null, resting: rec.resting_heart_rate, series: null } : null,
          hrv: num(rec.hrv_rmssd_milli) != null ? Math.round(rec.hrv_rmssd_milli) : null,
          respRate: num(s.score.respiratory_rate) != null ? round1(s.score.respiratory_rate) : null,
          spo2: num(rec.spo2_percentage) != null ? round1(rec.spo2_percentage) : null,
          stages: { deep, rem, light, awake: ms(st.total_awake_time_milli) },
          phases: null,
          awakenings: num(st.disturbance_count),
          latencyMin: null,
        };
      });
    return longestPerDay(nights);
  },
};

/* --------------------------------------------------------------- Withings */
/* Not standard OAuth on the token call: action=requesttoken, and every reply
 * is { status, body } with status 0 meaning OK. Sleep summaries cover stage
 * totals, wake-ups, heart rate and breathing rate (Sleep Analyzer mat or a
 * watch). Withings asks for no more than one pull per 10 minutes per person. */

async function withingsCall(url: string, form: Record<string, string>, token?: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: new URLSearchParams(form),
  });
  const body = await readJson(res);
  if (body.status === 0) return body.body;
  // 100–102 and 401: the token or grant is no good any more
  if ([100, 101, 102, 401].includes(body.status)) throw new ReconnectError(`withings ${body.status} ${body.error ?? ''}`);
  throw new Error(`withings ${res.status}/${body.status}: ${body.error ?? JSON.stringify(body).slice(0, 200)}`);
}

async function withingsToken(form: Record<string, string>): Promise<Tokens> {
  const b = await withingsCall('https://wbsapi.withings.net/v2/oauth2', { action: 'requesttoken', ...form });
  return {
    access_token: b.access_token,
    refresh_token: b.refresh_token ?? null,
    expires_at: b.expires_in ? new Date(Date.now() + b.expires_in * 1000).toISOString() : null,
    scope: b.scope ?? null,
    provider_user_id: b.userid != null ? String(b.userid) : null,
  };
}

const WITHINGS_FIELDS = [
  'total_timeinbed',
  'total_sleep_time',
  'lightsleepduration',
  'remsleepduration',
  'deepsleepduration',
  'wakeupduration',
  'wakeupcount',
  'sleep_latency',
  'hr_average',
  'hr_min',
  'rr_average',
].join(',');

const withings = {
  scope: 'user.activity',
  authorizeUrl(c: Creds, redirectUri: string, state: string) {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: c.clientId,
      scope: this.scope,
      redirect_uri: redirectUri,
      state,
    });
    // WITHINGS_DEMO=1: Withings' demo account, for testing without a device
    if (Deno.env.get('WITHINGS_DEMO') === '1') q.set('mode', 'demo');
    return `https://account.withings.com/oauth2_user/authorize2?${q}`;
  },
  exchange: (c: Creds, code: string, redirectUri: string) =>
    withingsToken({
      grant_type: 'authorization_code',
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  // a new refresh token comes back each time; the old one dies 8 h later
  refresh: (c: Creds, refreshToken: string) =>
    withingsToken({
      grant_type: 'refresh_token',
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: refreshToken,
    }),
  // revoking needs Withings' signed-request flow; disconnecting just forgets
  // the tokens, and the person can remove Nocta in the Withings app
  async revoke() {},
  async nights(token: string, from: string, to: string): Promise<Night[]> {
    const series: any[] = [];
    let offset: number | null = null;
    do {
      const form: Record<string, string> = {
        action: 'getsummary',
        startdateymd: from,
        enddateymd: to,
        data_fields: WITHINGS_FIELDS,
      };
      if (offset != null) form.offset = String(offset);
      const b = await withingsCall('https://wbsapi.withings.net/v2/sleep', form, token);
      series.push(...(b.series ?? []));
      offset = b.more ? b.offset : null;
    } while (offset != null);

    const nights = series.map((s: any): Night => {
      const d = s.data ?? {};
      const start = zoneWall(s.startdate, s.timezone);
      const stages =
        d.deepsleepduration != null || d.lightsleepduration != null
          ? {
              deep: hrs(d.deepsleepduration) ?? 0,
              rem: hrs(d.remsleepduration) ?? 0,
              light: hrs(d.lightsleepduration) ?? 0,
              awake: hrs(d.wakeupduration) ?? 0,
            }
          : null;
      return {
        date: sleepDay(start),
        start,
        end: zoneWall(s.enddate, s.timezone),
        inBedHours: hrs(d.total_timeinbed) ?? hrs(s.enddate - s.startdate) ?? 0,
        asleepHours: hrs(d.total_sleep_time),
        hr:
          num(d.hr_average) != null
            ? { avg: Math.round(d.hr_average), low: num(d.hr_min), resting: null, series: null }
            : null,
        hrv: null,
        respRate: num(d.rr_average),
        spo2: null,
        stages,
        phases: null,
        awakenings: num(d.wakeupcount),
        latencyMin: d.sleep_latency != null ? Math.round(d.sleep_latency / 60) : null,
      };
    });
    return longestPerDay(nights);
  },
};

export const PROVIDERS = { oura, whoop, withings } as const;
export type ProviderKey = keyof typeof PROVIDERS;
export const isProvider = (p: unknown): p is ProviderKey => typeof p === 'string' && p in PROVIDERS;

/* the app's client id + secret for a provider, from the function's secrets */
export function credsFor(p: ProviderKey): Creds | null {
  const id = Deno.env.get(`${p.toUpperCase()}_CLIENT_ID`);
  const secret = Deno.env.get(`${p.toUpperCase()}_CLIENT_SECRET`);
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}
