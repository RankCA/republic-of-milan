// Daily ping (Vercel cron) so the free Supabase project never pauses for inactivity.
const SUPABASE_URL = 'https://bzeghdivehdkvkaxzbgv.supabase.co';
const KEY = 'sb_publishable_2K_rGMa9rG6WTN6zKHSqvQ_0mebdzOj';

export default async function handler(req, res) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/acts?select=id&limit=1`, { headers: { apikey: KEY } });
  res.setHeader('Cache-Control', 'no-store');
  res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status });
}
