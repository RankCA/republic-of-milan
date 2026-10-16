// Local stand-in for the archive, used only on localhost with ?fake=1.
// It copies the live public acts once, then keeps every change in sessionStorage.
// Test seals: FAKE-KEEP (Keeper of the Seals) and FAKE-MP01 (ordinary MP).

import { ApiError, LIST_COLUMNS } from './api.js';

const STORE = 'fakeArchive';
const uuid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const STATUS_EVENT = {
  draft: 'Draft', tabled: 'Tabled in Parliament', debate: 'Opened for debate', vote: 'Put to the vote',
  passed: 'Passed by Parliament', signed: 'Signed', in_force: 'Entered into force', rejected: 'Rejected',
  withdrawn: 'Withdrawn', repealed: 'Repealed', expired: 'Expired',
};
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
const blobs = new Map();

export async function makeFakeApi(real) {
  let db = JSON.parse(sessionStorage.getItem(STORE) || 'null');
  if (!db) {
    const [acts, members] = await Promise.all([
      fetch(`${real.publicUrl('x').split('/storage/')[0]}/rest/v1/acts?select=*,events:act_events(*)`, { headers: { apikey: 'sb_publishable_2K_rGMa9rG6WTN6zKHSqvQ_0mebdzOj' } }).then((r) => r.json()),
      real.listMembers(),
    ]);
    const keeper = members.find((m) => m.role === 'keeper') || { id: uuid(), name: 'Test Keeper', title: 'Member of Parliament', role: 'keeper' };
    const mp = { id: uuid(), name: 'Test Deputy', title: 'Member of Parliament', party: 'Unity List', bio: null, role: 'mp', active: true };
    let eid = 1000;
    db = {
      acts: acts.map((a) => { delete a.fts; a.events.forEach((e) => (e.id = eid++)); return a; }),
      members: [{ ...keeper, active: true }, mp],
      seals: { 'FAKE-KEEP': keeper.id, 'FAKE-MP01': mp.id },
      eid,
    };
  }
  const save = () => sessionStorage.setItem(STORE, JSON.stringify(db));
  save();
  const delay = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const who = (seal) => {
    const id = Object.entries(db.seals).find(([k]) => norm(k) === norm(seal))?.[1];
    const m = db.members.find((x) => x.id === id && x.active);
    if (!m) throw new ApiError('This seal is not recognised.', 403, '28000');
    return m;
  };
  const keeperOnly = (m) => { if (m.role !== 'keeper') throw new ApiError('Only the Keeper of the Seals can do that.', 400); };
  const find = (id) => { const a = db.acts.find((x) => x.id === id); if (!a) throw new ApiError('That act could not be found.', 400); return a; };
  const event = (a, label, date, member, detail = null) => a.events.push({ id: db.eid++, act_id: a.id, happened_on: date || today(), label, detail, member_name: member?.name ?? null });
  const sortEvents = (a) => a.events.sort((p, q) => (p.happened_on < q.happened_on ? -1 : p.happened_on > q.happened_on ? 1 : p.id - q.id));
  const cols = LIST_COLUMNS.split(',');
  const pick = (a) => Object.fromEntries(cols.map((c) => [c, a[c] ?? null]));
  const newSeal = () => `FAKE-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    name: 'fake',
    publicUrl: (path) => blobs.get(path) || real.publicUrl(path),
    listActs: () => delay(db.acts.filter((a) => a.published).map(pick).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))),
    async getAct(slug) {
      const a = db.acts.find((x) => x.slug === slug && x.published);
      if (a) sortEvents(a);
      return delay(a || null);
    },
    searchActs(q) {
      const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const hits = db.acts.filter((a) => a.published).map((a) => {
        const hay = [a.title, a.subtitle, a.summary, (a.parties || []).join(' '), a.body, a.pdf_text].join(' ');
        const low = hay.toLowerCase();
        if (!words.every((w) => low.includes(w))) return null;
        const i = low.indexOf(words[0]);
        let snippet = hay.slice(Math.max(0, i - 80), i + 160).replace(/[#>*|_]+/g, ' ');
        for (const w of words) snippet = snippet.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}*)`, 'giu'), '[[$1]]');
        return { ...pick(a), snippet, rank: 1 };
      }).filter(Boolean);
      return delay(hits);
    },
    listMembers: () => delay(db.members.filter((m) => m.active)),
    forget() {},
    me: async (seal) => delay(who(seal)),
    portalActs: async (seal) => {
      who(seal);
      return delay(db.acts.map((a) => ({ ...pick(a), published: a.published, has_pdf: !!a.pdf_path, has_text: !!a.body, created_by: a.created_by })).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)));
    },
    portalAct: async (seal, id) => { who(seal); const a = find(id); sortEvents(a); return delay(a); },
    async saveAct(seal, input) {
      const m = who(seal);
      if (!input.title || input.title.trim().length < 3) throw new ApiError('new row for relation "acts" violates check constraint "acts_title_check"', 400);
      const nextNo = (kind) => Math.max(0, ...db.acts.filter((a) => a.kind === kind).map((a) => a.number)) + 1;
      let a = input.id ? find(input.id) : null;
      const old = a ? { ...a } : null;
      if (!a) {
        const number = nextNo(input.kind);
        a = { id: uuid(), slug: slugify(`${input.kind}-${number}-${input.title}`), kind: input.kind, number, events: [], created_by: m.id, created_at: new Date().toISOString() };
        db.acts.push(a);
      } else if (a.kind !== input.kind) {
        a.number = nextNo(input.kind);
      }
      const n = (v) => (v === '' || v === undefined ? null : v);
      Object.assign(a, {
        kind: input.kind, status: input.status || 'tabled', title: input.title.trim(), subtitle: n(input.subtitle?.trim()), summary: n(input.summary?.trim()),
        body: n(input.body?.trim()), pdf_path: n(input.pdf_path), pdf_name: n(input.pdf_name), pdf_size: n(input.pdf_size), pdf_pages: n(input.pdf_pages),
        pdf_text: 'pdf_text' in input ? n(input.pdf_text) : a.pdf_text ?? null,
        parties: (input.parties || []).map((p) => p.trim()).filter(Boolean), sponsor: n(input.sponsor?.trim()),
        introduced_on: n(input.introduced_on), passed_on: n(input.passed_on), effective_on: n(input.effective_on), expires_on: n(input.expires_on),
        votes_for: n(input.votes_for) === null ? null : Number(input.votes_for), votes_against: n(input.votes_against) === null ? null : Number(input.votes_against),
        votes_abstain: n(input.votes_abstain) === null ? null : Number(input.votes_abstain),
        published: input.published !== false, updated_by: m.id, updated_at: new Date().toISOString(),
      });
      if (!old) event(a, 'Entered in the register', a.introduced_on, m);
      const dateFor = { passed: a.passed_on, in_force: a.effective_on, tabled: a.introduced_on };
      if ((!old && !['draft', 'tabled'].includes(a.status)) || (old && old.status !== a.status)) event(a, STATUS_EVENT[a.status], dateFor[a.status], m);
      if (old && (old.body !== a.body || old.pdf_path !== a.pdf_path)) event(a, 'Text amended', null, m);
      sortEvents(a);
      save();
      return delay(a);
    },
    async deleteAct(seal, id) {
      const m = who(seal);
      const a = find(id);
      if (m.role !== 'keeper' && a.created_by !== m.id) throw new ApiError('Only the Keeper of the Seals or the member who entered this act can delete it.', 400);
      db.acts = db.acts.filter((x) => x.id !== id);
      save();
      return delay(null);
    },
    async addEvent(seal, actId, date, label, detail) {
      const m = who(seal);
      const a = find(actId);
      event(a, label.trim(), date, m, detail || null);
      sortEvents(a);
      save();
      return delay(a);
    },
    async deleteEvent(seal, eventId) {
      who(seal);
      const a = db.acts.find((x) => x.events.some((e) => e.id === eventId));
      if (!a) throw new ApiError('That entry could not be found.', 400);
      a.events = a.events.filter((e) => e.id !== eventId);
      save();
      return delay(a);
    },
    async uploadPdf(seal, file) {
      who(seal);
      const path = `${uuid()}/${slugify(file.name.replace(/\.pdf$/i, '')) || 'document'}.pdf`;
      blobs.set(path, URL.createObjectURL(file));
      return delay(path);
    },
    async members(seal) {
      keeperOnly(who(seal));
      return delay(db.members.map((m) => ({ ...m, last_used: null, issued_at: null })));
    },
    async addMember(seal, input) {
      keeperOnly(who(seal));
      if (!input.name?.trim()) throw new ApiError('new row for relation "members" violates check constraint "members_name_check"', 400);
      const m = { id: uuid(), name: input.name.trim(), title: input.title?.trim() || 'Member of Parliament', party: input.party?.trim() || null, bio: input.bio?.trim() || null, role: input.role || 'mp', active: true, created_at: new Date().toISOString() };
      db.members.push(m);
      const s = newSeal();
      db.seals[s] = m.id;
      save();
      return delay({ member: m, seal: s });
    },
    async updateMember(seal, input) {
      const me = who(seal);
      const other = input.id !== me.id;
      if (other) keeperOnly(me);
      const m = db.members.find((x) => x.id === input.id);
      if (!m) throw new ApiError('That member could not be found.', 400);
      if (input.name?.trim()) m.name = input.name.trim();
      if ('title' in input) m.title = input.title?.trim() || 'Member of Parliament';
      if ('party' in input) m.party = input.party?.trim() || null;
      if ('bio' in input) m.bio = input.bio?.trim() || null;
      if (other && 'role' in input) m.role = input.role;
      if (other && 'active' in input) m.active = input.active;
      save();
      return delay(m);
    },
    async newSeal(seal, memberId) {
      const me = who(seal);
      if (memberId !== me.id) keeperOnly(me);
      for (const [k, v] of Object.entries(db.seals)) if (v === memberId) delete db.seals[k];
      const s = newSeal();
      db.seals[s] = memberId;
      save();
      return delay(s);
    },
  };
}
