// SVG pieces drawn in the same style as the Republic's home page:
// the shield of Saint Ambrose, the wax seal, and the semicircle of seats.

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

const SHIELD = 'M2 2h28v14c0 9.5-6.6 15.6-14 18C8.6 31.6 2 25.5 2 16z';
const CROSS = 'M13 2h6v30.5h-6zM2 11h28v6H2z';

/** The crest (same drawing as the header of the home page). */
export function crest(size = 32, className = '') {
  return `<svg class="crest ${className}" viewBox="0 0 32 36" width="${size}" height="${Math.round(size * 36 / 32)}" aria-hidden="true" focusable="false"><use href="#crest"/></svg>`;
}

const SEAL_FILL = {
  force: '#2f5d3a',
  pending: '#80612f',
  failed: '#8e2a1f',
  ended: '#3a3f37',
};

/** Wax seal in the style of the poster seal, stamped with an act's status. */
export function seal({ label, group = 'force', size = 128 } = {}) {
  const ring = nextId('ring');
  const word = String(label).toUpperCase();
  const fs = word.length > 9 ? 8.4 : word.length > 7 ? 9.6 : 11;
  return `<svg class="seal" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Status: ${label}" focusable="false">
    <defs><path id="${ring}" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0"/></defs>
    <circle cx="60" cy="60" r="58" fill="${SEAL_FILL[group] || SEAL_FILL.force}"/>
    <circle cx="60" cy="60" r="54.5" fill="none" stroke="#e3c48a" stroke-width="1"/>
    <circle cx="60" cy="60" r="31" fill="none" stroke="#e3c48a" stroke-width="1"/>
    <text fill="#f6edda" font-family="Cinzel, serif" font-weight="700" font-size="8.6"><textPath href="#${ring}" textLength="262" lengthAdjust="spacing">PARLIAMENT OF MILAN &#183; ANNO MMXXVI &#183;</textPath></text>
    <g transform="translate(51 37) scale(.56)">
      <path d="${SHIELD}" fill="#f6edda"/><path d="${CROSS}" fill="#b8352b"/>
      <path d="${SHIELD}" fill="none" stroke="#e3c48a" stroke-width="1.5"/>
    </g>
    <text x="60" y="${71 + fs * 0.9}" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="${fs}" letter-spacing=".5" fill="#f6edda">${word}</text>
  </svg>`;
}

/** Semicircle of seats. groups: [{count, color, label}] filled from left to right. */
export function hemicycle(groups, { width = 320, empty = '#d3c095' } = {}) {
  const total = groups.reduce((s, g) => s + (g.count || 0), 0);
  if (!total) return '';
  const N = Math.min(total, 600);
  const rows = Math.max(1, Math.min(12, Math.round(Math.sqrt(N / 4))));
  const R1 = 100, R0 = rows === 1 ? 100 : 46;
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? R1 : R0 + ((R1 - R0) * i) / (rows - 1)));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.floor((N * r) / sum));
  let rest = N - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; rest > 0; i = (i - 1 + rows) % rows, rest--) counts[i]++;
  const seats = [];
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let j = 0; j < n; j++) {
      const a = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (n - 1);
      seats.push({ a, x: 110 + r * Math.cos(a), y: 108 - r * Math.sin(a) });
    }
  });
  seats.sort((p, q) => q.a - p.a);
  const dot = Math.max(2.2, Math.min(9, ((Math.PI * R1) / (counts[rows - 1] || 1)) * 0.38));
  const colors = [];
  for (const g of groups) for (let i = 0; i < (g.count || 0); i++) colors.push(g.color);
  let k = 0;
  const circles = seats.map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${dot.toFixed(1)}" fill="${colors[k++] || empty}"/>`).join('');
  return `<svg class="hemicycle" viewBox="0 0 220 116" width="${width}" role="img" aria-label="${groups.map((g) => `${g.count} ${g.label}`).join(', ')}">${circles}</svg>`;
}

/** Icons from the sprite in parliament/index.html (Lucide, as on the home page). */
export const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
