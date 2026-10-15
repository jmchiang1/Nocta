/* Nocta — Supabase client. Configured from .env.local (see docs/AUTH_SETUP.md):
 *   VITE_SUPABASE_URL              https://<project-ref>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY  sb_publishable_…  (safe in the browser; never the secret key)
 * Without them `supabase` is null and the app runs on the mock sign-in. */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const authConfigured = Boolean(url && key);

/* which sign-in providers the project has switched on (public endpoint) */
export async function enabledProviders() {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`auth settings ${res.status}`);
  const { external = {} } = await res.json();
  return external;
}

export const supabase = authConfigured
  ? createClient(url, key, {
      auth: {
        // PKCE: the redirect comes back with a one-time ?code= the client
        // exchanges itself, instead of tokens sitting in the URL hash
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
