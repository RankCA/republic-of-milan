// Serves the app shell for /acts/:slug with the act's own title and description,
// so links shared in Discord unfurl as the act rather than the home page.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = 'https://bzeghdivehdkvkaxzbgv.supabase.co';
const KEY = 'sb_publishable_2K_rGMa9rG6WTN6zKHSqvQ_0mebdzOj';
const KINDS = { constitution: 'Constitution', law: 'Law', bill: 'Bill', treaty: 'Treaty', resolution: 'Resolution', decree: 'Decree', amendment: 'Amendment', motion: 'Motion' };
const STATUSES = { draft: 'Draft', tabled: 'Tabled', debate: 'In Debate', vote: 'At Vote', passed: 'Passed', signed: 'Signed', in_force: 'In Force', rejected: 'Rejected', withdrawn: 'Withdrawn', repealed: 'Repealed', expired: 'Expired' };

let shell;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function setMeta(html, attr, key, value) {
  const rx = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  return rx.test(html) ? html.replace(rx, `$1${esc(value)}$2`) : html.replace('</head>', `  <meta ${attr}="${key}" content="${esc(value)}">\n</head>`);
}

export default async function handler(req, res) {
  shell ??= await readFile(join(process.cwd(), 'parliament', 'index.html'), 'utf8');
  let html = shell;
  const slug = String(req.query.slug || '');
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/acts?slug=eq.${encodeURIComponent(slug)}&select=kind,number,status,title,subtitle,summary,parties&limit=1`, { headers: { apikey: KEY } });
    const act = r.ok ? (await r.json())[0] : null;
    if (act) {
      const ref = `${KINDS[act.kind] || act.kind} No. ${act.number}`;
      const title = `${act.title}: ${ref}`;
      const desc = act.summary || act.subtitle || `${ref} of the Republic of Milan. Status: ${STATUSES[act.status] || act.status}.`;
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(act.title)} &middot; Republic of Milan</title>`);
      html = setMeta(html, 'name', 'description', desc);
      html = setMeta(html, 'property', 'og:title', title);
      html = setMeta(html, 'property', 'og:description', `${STATUSES[act.status] || ''}. ${desc}`.replace(/^\. /, ''));
      html = setMeta(html, 'property', 'og:type', 'article');
      html = setMeta(html, 'property', 'og:url', `https://${req.headers.host}/parliament/acts/${slug}`);
    } else {
      res.statusCode = 404;
    }
  } catch {
    // Fall back to the plain shell; the page still loads the act in the browser.
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  res.end(html);
}
