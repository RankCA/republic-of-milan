// Markup shared by several Parliament pages.

import { crest } from './art.js';
import { esc, fmtDate, keyDate, keyDateLabel, kindLabel, reference, roman, statusGroup, statusLabel, to } from './util.js';

export const statusPill = (s) => `<span class="status g-${statusGroup(s)}">${esc(statusLabel(s))}</span>`;

export const partyChips = (parties = [], link = true) =>
  parties.length
    ? `<div class="chips">${parties.map((p) => (link ? `<a class="chip" href="${to(`?party=${encodeURIComponent(p)}`)}">${esc(p)}</a>` : `<span class="chip">${esc(p)}</span>`)).join('')}</div>`
    : '';

export const actHref = (a) => to(`/acts/${encodeURIComponent(a.slug)}`);

/** Turn a search snippet with [[ ]] markers into safe HTML with <mark>. */
export const snippetHtml = (s) => esc(s).replace(/\[\[/g, '<mark>').replace(/\]\]/g, '</mark>');

export function actRow(a, snippet) {
  const date = keyDate(a);
  return `<li class="act-row">
    <div class="act-num" aria-hidden="true"><small>${esc(kindLabel(a.kind))}</small><b>${roman(a.number)}</b></div>
    <div>
      <h3><a href="${actHref(a)}">${esc(a.title)}</a></h3>
      <p class="ref">${esc(reference(a))}</p>
      ${a.subtitle ? `<p class="sub">${esc(a.subtitle)}</p>` : ''}
      ${snippet ? `<p class="snippet">${snippetHtml(snippet)}</p>` : a.summary ? `<p class="snippet">${esc(a.summary)}</p>` : ''}
      ${partyChips(a.parties, false)}
    </div>
    <div class="act-side">${statusPill(a.status)}${date ? `<span>${keyDateLabel(a)} ${fmtDate(date)}</span>` : ''}</div>
  </li>`;
}

export const loading = (text = 'Consulting the archive') => `<p class="loading">${text}</p>`;

export function emptyState(title, text, action = '') {
  return `<div class="empty">${crest(44)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
}
