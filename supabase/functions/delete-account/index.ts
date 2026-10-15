// Nocta — delete the calling user's account (Settings › Delete account).
// A browser can't delete its own Supabase user, so the app calls this
// function with the user's session; it checks who that is and deletes
// exactly that user, using the service role key Supabase provides to
// Edge Functions (never shipped to the app).
//
// Deploy:  supabase functions deploy delete-account --project-ref <ref>
import { createClient } from 'npm:@supabase/supabase-js@2.117.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return Response.json({ error: 'not signed in' }, { status: 401, headers: cors });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // who is asking: only ever the holder of this session
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return Response.json({ error: 'not signed in' }, { status: 401, headers: cors });

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return Response.json({ error: 'could not delete' }, { status: 500, headers: cors });

  return Response.json({ deleted: true }, { headers: cors });
});
