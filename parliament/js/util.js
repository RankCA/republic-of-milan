// Small shared helpers: escaping, dates, labels for kinds and statuses.

// The Parliament lives under /parliament on the Republic's site.
export const BASE = '/parliament';
export const to = (path = '') => `${BASE}${path}`;

export function roman(n) {
  let x = Math.max(0, Math.floor(Number(n) || 0));
  if (!x || x > 3999) return String(n);
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map) while (x >= v) { out += r; x -= v; }
  return out;
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const KINDS = {
  constitution: { label: 'Constitution', plural: 'Constitution' },
  law: { label: 'Law', plural: 'Laws' },
  bill: { label: 'Bill', plural: 'Bills' },
  treaty: { label: 'Treaty', plural: 'Treaties' },
  resolution: { label: 'Resolution', plural: 'Resolutions' },
  decree: { label: 'Decree', plural: 'Decrees' },
  amendment: { label: 'Amendment', plural: 'Amendments' },
  motion: { label: 'Motion', plural: 'Motions' },
};
export const KIND_ORDER = ['treaty', 'law', 'bill', 'resolution', 'decree', 'amendment', 'motion', 'constitution'];

// group: force (green), pending (gold), failed (crimson), ended (ink)
export const STATUSES = {
  draft: { label: 'Draft', group: 'pending' },
  tabled: { label: 'Tabled', group: 'pending' },
  debate: { label: 'In Debate', group: 'pending' },
  vote: { label: 'At Vote', group: 'pending' },
  passed: { label: 'Passed', group: 'force' },
  signed: { label: 'Signed', group: 'force' },
  in_force: { label: 'In Force', group: 'force' },
  rejected: { label: 'Rejected', group: 'failed' },
  withdrawn: { label: 'Withdrawn', group: 'failed' },
  repealed: { label: 'Repealed', group: 'ended' },
  expired: { label: 'Expired', group: 'ended' },
};
export const STATUS_ORDER = ['draft', 'tabled', 'debate', 'vote', 'passed', 'signed', 'in_force', 'rejected', 'withdrawn', 'repealed', 'expired'];

export const STATUS_GROUPS = {
  force: 'Passed or in force',
  pending: 'Before Parliament',
  failed: 'Rejected or withdrawn',
  ended: 'Repealed or expired',
};

export const kindLabel = (k) => KINDS[k]?.label ?? k;
export const statusLabel = (s) => STATUSES[s]?.label ?? s;
export const statusGroup = (s) => STATUSES[s]?.group ?? 'pending';
export const reference = (a) => `${kindLabel(a.kind)} No. ${a.number}`;
// For Cinzel headings: the number set in Playfair so 1 never reads as I.
export const refHtml = (a) => `${esc(kindLabel(a.kind))} No. <span class="n">${Number(a.number)}</span>`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtDate(iso, short = false) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const month = short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1];
  return `${d} ${month} ${y}`;
}

// The date that best describes where an act stands.
export function keyDate(a) {
  return a.effective_on && a.status === 'in_force' ? a.effective_on
    : a.passed_on || a.introduced_on || (a.created_at || a.updated_at || '').slice(0, 10);
}

export function keyDateLabel(a) {
  if (a.status === 'in_force' && a.effective_on) return 'In force from';
  if (a.passed_on) return 'Passed';
  if (a.introduced_on) return 'Introduced';
  return 'Entered';
}

export function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name) {
  const parts = String(name || '').replace(/^(hon\.?|the)\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

export function toast(message, kind = 'ok') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Stable colour for a party or partner name.
export function hueFor(name) {
  let x = 0;
  for (const ch of String(name)) x = (x * 31 + ch.codePointAt(0)) >>> 0;
  return x % 360;
}
