// /parliament: the Register of acts, with search and filters.

import { api } from '../api.js';
import { icon, seal } from '../art.js';
import { actHref, actRow, emptyState, statusPill } from '../components.js';
import { setTitle } from '../app.js';
import { KINDS, KIND_ORDER, STATUSES, STATUS_GROUPS, STATUS_ORDER, debounce, esc, fmtDate, keyDate, keyDateLabel, refHtml, statusGroup, statusLabel, to } from '../util.js';

const SORTS = {
  newest: ['Newest first', (a, b) => (keyDate(b) || '').localeCompare(keyDate(a) || '') || b.updated_at.localeCompare(a.updated_at)],
  oldest: ['Oldest first', (a, b) => (keyDate(a) || '').localeCompare(keyDate(b) || '') || a.updated_at.localeCompare(b.updated_at)],
  number: ['By number', (a, b) => a.kind.localeCompare(b.kind) || a.number - b.number],
  title: ['By title', (a, b) => a.title.localeCompare(b.title)],
};

export async function render(main, { query, isCurrent }) {
  const state = {
    q: query.get('q') || '',
    type: KINDS[query.get('type')] ? query.get('type') : '',
    status: query.get('status') || '',
    party: query.get('party') || '',
    sort: SORTS[query.get('sort')] ? query.get('sort') : 'newest',
  };
  const filtered = !!(state.q || state.type || state.status || state.party);
  setTitle(state.type ? KINDS[state.type].plural : 'Parliament');

  main.innerHTML = `
  <section class="hero dark" aria-labelledby="reg-title">
    <div class="container hero-inner">
      <div>
        <p class="eyebrow">${icon('landmark')}<span>Parliament of the Republic</span></p>
        <h1 id="reg-title"><span class="the">The</span> <span>Laws of</span> <span class="accent">Milan</span></h1>
        <p class="lede">Every law, treaty and resolution laid before Parliament, published in full for every citizen.</p>
        <form class="search" role="search" id="hero-search">
          ${icon('search')}
          <label class="sr-only" for="hero-q">Search the laws of the Republic</label>
          <input id="hero-q" type="search" placeholder="Search the laws" autocomplete="off" value="${esc(state.q)}">
          <button class="btn btn-red" type="submit"><span>Search</span>${icon('arrow-right')}</button>
        </form>
      </div>
      <div id="gazette"></div>
    </div>
  </section>
  <section class="motto" aria-label="The Register in figures"><div class="container motto-grid" id="figures">
    ${['Acts in the Register', 'Treaties', 'Before Parliament', 'Members'].map((l) => `<div class="motto-item"><strong>&nbsp;</strong><span>${l}</span></div>`).join('')}
  </div></section>
  <section class="section paper" id="register" aria-labelledby="register-title">
    <div class="container">
      <header class="section-head">
        <p class="kicker">The Register</p>
        <h2 id="register-title">Acts of Parliament</h2>
        <p class="intro">Search reaches into the full text of every act, so the obligations of the Republic are never more than a few words away.</p>
      </header>
      <div class="filters">
        <div class="filter-row">
          <label class="field-search">${icon('search')}<span class="sr-only">Search the Register</span>
            <input type="search" id="q" placeholder="Search titles and full text" value="${esc(state.q)}" autocomplete="off">
          </label>
          <label><span class="sr-only">Status</span>
            <select class="select" id="status">
              <option value="">Any status</option>
              <optgroup label="Groups">${Object.entries(STATUS_GROUPS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</optgroup>
              <optgroup label="Exact status">${STATUS_ORDER.filter((s) => s !== 'draft').map((s) => `<option value="${s}">${STATUSES[s].label}</option>`).join('')}</optgroup>
            </select>
          </label>
          <label><span class="sr-only">Sort</span>
            <select class="select" id="sort">${Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join('')}</select>
          </label>
        </div>
        <div class="kinds" role="group" aria-label="Type of act" id="kinds"></div>
      </div>
      <div class="result-meta" id="meta" aria-live="polite"></div>
      <ol class="ledger" id="list"><li class="loading" style="padding:40px">Consulting the archive</li></ol>
    </div>
  </section>`;

  const $ = (s) => main.querySelector(s);
  $('#status').value = state.status;
  $('#sort').value = state.sort;
  if (filtered) requestAnimationFrame(() => $('#register').scrollIntoView());

  let acts = [];
  let hits = null;
  let seq = 0;

  function syncUrl() {
    const p = new URLSearchParams();
    for (const k of ['q', 'type', 'status', 'party']) if (state[k]) p.set(k, state[k]);
    if (state.sort !== 'newest') p.set('sort', state.sort);
    history.replaceState({ keepScroll: true }, '', to(p.toString() ? `?${p}` : ''));
    setTitle(state.type ? KINDS[state.type].plural : 'Parliament');
    document.querySelectorAll('.nav a, .subnav a').forEach((a) => {
      const u = new URL(a.href);
      const on = u.pathname === to('') && (u.searchParams.get('type') === 'treaty') === (state.type === 'treaty');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  const matchesStatus = (a) => !state.status || (STATUS_GROUPS[state.status] ? statusGroup(a.status) === state.status : a.status === state.status);

  function draw() {
    const base = acts.filter((a) => matchesStatus(a) && (!state.party || (a.parties || []).includes(state.party)));
    const counts = {};
    for (const a of base) counts[a.kind] = (counts[a.kind] || 0) + 1;
    $('#kinds').innerHTML = [`<button class="kind" type="button" data-k="" aria-pressed="${!state.type}">All<b>${base.length}</b></button>`]
      .concat(KIND_ORDER.filter((k) => counts[k] || state.type === k).map((k) => `<button class="kind" type="button" data-k="${k}" aria-pressed="${state.type === k}">${KINDS[k].plural}<b>${counts[k] || 0}</b></button>`))
      .join('');

    let list = base.filter((a) => !state.type || a.kind === state.type);
    if (hits) list = [...hits.keys()].map((slug) => list.find((a) => a.slug === slug)).filter(Boolean);
    else list.sort(SORTS[state.sort][1]);

    const bits = [];
    if (state.q) bits.push(`matching "${esc(state.q)}"`);
    if (state.party) bits.push(`with ${esc(state.party)} <button class="btn-link" type="button" id="clear-party">show all</button>`);
    $('#meta').innerHTML = `<span>${list.length} ${list.length === 1 ? 'act' : 'acts'}${bits.length ? ` ${bits.join(' ')}` : ''}</span>${hits ? '<span>Ranked by relevance</span>' : ''}`;
    $('#clear-party')?.addEventListener('click', () => { state.party = ''; syncUrl(); draw(); });

    $('#list').innerHTML = list.length
      ? list.map((a) => actRow(a, hits?.get(a.slug))).join('')
      : `<li>${emptyState('Nothing found', state.q ? 'No act contains those words. Try fewer or different words.' : 'No act matches these filters yet.', `<a class="btn btn-line" href="${to('')}">Clear the filters</a>`)}</li>`;
  }

  async function runSearch() {
    const mine = ++seq;
    if (!state.q.trim()) { hits = null; draw(); return; }
    try {
      const rows = await api.searchActs(state.q.trim());
      if (mine !== seq || !isCurrent()) return;
      hits = new Map(rows.map((r) => [r.slug, r.snippet]));
    } catch {
      if (mine !== seq) return;
      const q = state.q.toLowerCase();
      hits = new Map(acts.filter((a) => `${a.title} ${a.subtitle} ${a.summary} ${(a.parties || []).join(' ')}`.toLowerCase().includes(q)).map((a) => [a.slug, '']));
    }
    draw();
  }

  const setQuery = (q) => { state.q = q; $('#q').value = q; $('#hero-q').value = q; syncUrl(); runSearch(); };
  $('#q').addEventListener('input', debounce(() => setQuery($('#q').value), 250));
  $('#hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    setQuery($('#hero-q').value.trim());
    $('#register').scrollIntoView({ behavior: 'smooth' });
  });
  $('#status').addEventListener('change', (e) => { state.status = e.target.value; syncUrl(); draw(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; syncUrl(); draw(); });
  $('#kinds').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    state.type = b.dataset.k;
    syncUrl();
    draw();
  });

  const [list, members] = await Promise.all([api.listActs(), api.listMembers().catch(() => [])]);
  if (!isCurrent()) return;
  acts = list;

  const latest = [...acts].sort(SORTS.newest[1])[0];
  $('#gazette').innerHTML = latest ? `
    <article class="gazette">
      ${seal({ label: statusLabel(latest.status), group: statusGroup(latest.status), size: 116 })}
      <p class="kicker plain" style="margin-bottom:8px">Latest in the Gazette</p>
      <p class="ref">${refHtml(latest)}</p>
      <h2>${esc(latest.title)}</h2>
      ${latest.summary ? `<p class="sum">${esc(latest.summary)}</p>` : ''}
      <footer>${statusPill(latest.status)}<a class="link-arrow" href="${actHref(latest)}">Read the act${icon('arrow-right')}</a></footer>
      ${keyDate(latest) ? `<p class="hint" style="margin-top:10px">${keyDateLabel(latest)} ${fmtDate(keyDate(latest))}</p>` : ''}
    </article>` : '';

  const count = (fn) => acts.filter(fn).length;
  $('#figures').innerHTML = [
    [acts.length, 'Acts in the Register', to('')],
    [count((a) => a.kind === 'treaty'), 'Treaties', to('?type=treaty')],
    [count((a) => statusGroup(a.status) === 'pending'), 'Before Parliament', to('?status=pending')],
    [members.length, 'Members', to('/members')],
  ].map(([n, label, href]) => `<a class="motto-item" href="${href}"><strong>${n}</strong><span>${label}</span></a>`).join('');

  if (state.q) await runSearch();
  else draw();
}
