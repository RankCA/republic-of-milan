// Talks to the Republic's Supabase project. Reads are public; every write passes
// through a portal_* database function that checks the MP's seal.

export const SUPABASE_URL = 'https://bzeghdivehdkvkaxzbgv.supabase.co';
// Publishable key: safe to ship in the page, it only grants what RLS allows.
const KEY = 'sb_publishable_2K_rGMa9rG6WTN6zKHSqvQ_0mebdzOj';
const BUCKET = 'documents';

export const LIST_COLUMNS = 'id,slug,kind,number,status,title,subtitle,summary,parties,sponsor,introduced_on,passed_on,effective_on,expires_on,votes_for,votes_against,votes_abstain,pdf_path,created_at,updated_at';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers: { apikey: KEY, ...(body !== undefined && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('The archive could not be reached. Check your connection and try again.', 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.message || data.error_description || data.error)) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data && data.code);
  }
  return data;
}

const rpc = (fn, args) => request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });

let actsCache = null;

export const realApi = {
  name: 'live',

  publicUrl(path) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
  },

  async listActs({ fresh = false } = {}) {
    if (!actsCache || fresh) {
      actsCache = request(`/rest/v1/acts?select=${LIST_COLUMNS}&order=updated_at.desc`).catch((e) => {
        actsCache = null;
        throw e;
      });
    }
    return actsCache;
  },

  async getAct(slug) {
    const rows = await request(`/rest/v1/acts?slug=eq.${encodeURIComponent(slug)}&select=*,events:act_events(id,happened_on,label,detail,member_name)&limit=1`);
    const act = rows && rows[0];
    if (act) act.events = (act.events || []).sort((a, b) => (a.happened_on < b.happened_on ? -1 : a.happened_on > b.happened_on ? 1 : a.id - b.id));
    return act || null;
  },

  searchActs(q) {
    return rpc('search_acts', { q });
  },

  listMembers() {
    return request('/rest/v1/members?select=id,name,title,party,bio,role,created_at&order=name.asc');
  },

  forget() { actsCache = null; },

  // Portal (seal required) --------------------------------------------------
  me: (seal) => rpc('portal_me', { p_seal: seal }),
  portalActs: (seal) => rpc('portal_acts', { p_seal: seal }),
  portalAct: (seal, id) => rpc('portal_act', { p_seal: seal, p_id: id }),
  async saveAct(seal, act) {
    const r = await rpc('portal_save_act', { p_seal: seal, p_act: act });
    actsCache = null;
    return r;
  },
  async deleteAct(seal, id) {
    await rpc('portal_delete_act', { p_seal: seal, p_id: id });
    actsCache = null;
  },
  addEvent: (seal, actId, date, label, detail) => rpc('portal_add_event', { p_seal: seal, p_act_id: actId, p_date: date || null, p_label: label, p_detail: detail || null }),
  deleteEvent: (seal, eventId) => rpc('portal_delete_event', { p_seal: seal, p_event_id: eventId }),
  async uploadPdf(seal, file) {
    const path = await rpc('portal_upload_ticket', { p_seal: seal, p_filename: file.name || 'document.pdf' });
    await request(`/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false', 'cache-control': 'max-age=31536000' },
    });
    return path;
  },
  members: (seal) => rpc('portal_members', { p_seal: seal }),
  addMember: (seal, member) => rpc('portal_add_member', { p_seal: seal, p_member: member }),
  updateMember: (seal, member) => rpc('portal_update_member', { p_seal: seal, p_member: member }),
  newSeal: (seal, memberId) => rpc('portal_new_seal', { p_seal: seal, p_member_id: memberId }),
};

// On localhost, ?fake=1 swaps in an in-browser stand-in so the portal can be
// exercised without touching the live archive.
let chosen = realApi;
export async function initApi() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  if (local && params.has('fake')) sessionStorage.setItem('fakeApi', params.get('fake') === '0' ? '' : '1');
  if (local && sessionStorage.getItem('fakeApi')) {
    const { makeFakeApi } = await import('./fake.js');
    chosen = await makeFakeApi(realApi);
  }
  return chosen;
}
export const api = new Proxy({}, { get: (_, k) => chosen[k] });
