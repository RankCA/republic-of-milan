// Router and header for the Parliament pages under /parliament.

import { api, initApi } from './api.js';
import { crest, icon } from './art.js';
import { BASE, esc, to } from './util.js';
import { currentMember, onSessionChange, restore } from './session.js';

const routes = [
  [/^\/?$/, () => import('./views/register.js')],
  [/^\/acts\/([^/]+)\/?$/, () => import('./views/act.js')],
  [/^\/members\/?$/, () => import('./views/members.js')],
  [/^\/portal\/?$/, () => import('./views/portal.js')],
  [/^\/portal\/(new)\/?$/, () => import('./views/editor.js')],
  [/^\/portal\/edit\/([^/]+)\/?$/, () => import('./views/editor.js')],
  [/^\/portal\/seals\/?$/, () => import('./views/seals.js')],
  [/^\/portal\/profile\/?$/, () => import('./views/profile.js')],
];

const main = document.getElementById('main');
let cleanup = null;
let renderId = 0;
let guard = null;

export function setTitle(title) {
  document.title = title ? `${title} · Republic of Milan` : 'Parliament · Republic of Milan';
}

export function setLeaveGuard(fn) { guard = fn; }

export function navigate(url, { replace = false } = {}) {
  if (guard) {
    const msg = guard();
    if (msg && !confirm(msg)) return;
    guard = null;
  }
  const target = new URL(url, location.origin);
  if (target.origin !== location.origin || !target.pathname.startsWith(BASE)) { location.href = target.href; return; }
  history[replace ? 'replaceState' : 'pushState'](null, '', target.pathname + target.search + target.hash);
  route();
}

const sub = () => location.pathname.slice(BASE.length) || '/';

function renderHeader() {
  const m = currentMember();
  const path = sub();
  const treaties = path === '/' && new URLSearchParams(location.search).get('type') === 'treaty';
  const links = [
    [to(''), 'The Register', (path === '/' && !treaties) || path.startsWith('/acts/')],
    [to('?type=treaty'), 'Treaties', treaties],
    [to('/members'), 'Members', path.startsWith('/members')],
  ];
  const navLinks = links.map(([href, label, on]) => `<a href="${href}"${on ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  document.getElementById('site-header').innerHTML = `
  <div class="container header-inner">
    <div class="brand-wrap">
      <a class="brand" href="/"><svg aria-hidden="true" focusable="false"><use href="#crest"/></svg>Republic of Milan</a>
      <a class="brand-tag" href="${to('')}">Parliament</a>
    </div>
    <nav class="nav" aria-label="Parliament">${navLinks}</nav>
    <a class="btn btn-red btn-sm" href="${to('/portal')}">${icon('key')}<span>${m ? `Portal<span class="hide-sm">: ${esc(m.name.split(' ')[0])}</span>` : 'Members<span class="hide-sm">’ Entrance</span>'}</span></a>
  </div>
  <div class="container subnav" aria-label="Parliament">${navLinks}</div>`;
}

async function route() {
  const id = ++renderId;
  const path = sub().replace(/\/+$/, '') || '/';
  const query = new URLSearchParams(location.search);
  let match = null;
  let loader = null;
  for (const [rx, load] of routes) {
    match = path.match(rx);
    if (match) { loader = load; break; }
  }
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  guard = null;
  renderHeader();
  if (!loader) loader = () => import('./views/notfound.js');
  try {
    const view = await loader();
    if (id !== renderId) return;
    const result = await view.render(main, { params: match ? match.slice(1) : [], query, navigate, isCurrent: () => id === renderId });
    if (id !== renderId) { if (typeof result === 'function') result(); return; }
    cleanup = typeof result === 'function' ? result : null;
  } catch (e) {
    console.error(e);
    if (id !== renderId) return;
    main.innerHTML = `<section class="section paper"><div class="container empty">${crest(44)}<h3>The archive could not be opened</h3><p>${esc(e.message || 'Something went wrong.')}</p><a class="btn btn-line" href="${esc(location.pathname + location.search)}">Try again</a></div></section>`;
  }
  if (location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
  else if (!history.state?.keepScroll) window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download')) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#')) return;
  const url = new URL(a.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || /\.[a-z0-9]{2,4}$/i.test(url.pathname)) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', url.hash);
    return;
  }
  navigate(url.pathname + url.search + url.hash);
});

addEventListener('popstate', () => route());
addEventListener('beforeunload', (e) => {
  if (guard && guard()) { e.preventDefault(); e.returnValue = ''; }
});
onSessionChange(() => renderHeader());

(async () => {
  await initApi();
  restore();
  route();
})();
