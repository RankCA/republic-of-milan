// /parliament/acts/:slug: one act, typeset, with its original PDF and its passage.

import { api } from '../api.js';
import { crest, hemicycle, icon, seal } from '../art.js';
import { emptyState, loading, partyChips, statusPill } from '../components.js';
import { render as renderText } from '../markup.js';
import { setTitle } from '../app.js';
import { currentMember } from '../session.js';
import { copyText, esc, fmtBytes, fmtDate, kindLabel, reference, refHtml, statusGroup, statusLabel, to, toast } from '../util.js';

export function docSheet(a, body) {
  const { html } = renderText(body);
  return `<article class="doc-sheet">
    <header class="doc-masthead">
      ${crest(40)}
      <div class="state">Republic of Milan</div>
      <div class="house">Parliament</div>
      <p class="kicker">${a.number ? refHtml(a) : `New ${esc(kindLabel(a.kind).toLowerCase())}`}</p>
      <h1>${esc(a.title || 'Untitled act')}</h1>
      ${a.subtitle ? `<p class="doc-sub">${esc(a.subtitle)}</p>` : ''}
      <hr>
    </header>
    <div class="doc-body">${html || '<p class="doc-p hint">The text of this act has not been entered yet.</p>'}</div>
    <footer class="doc-foot">
      <span>${a.number ? esc(reference(a)) : `${esc(kindLabel(a.kind))}, numbered when entered in the Register`}${a.passed_on ? `. Passed ${fmtDate(a.passed_on)}.` : '.'}<br>Published by the Parliament of the Republic of Milan.</span>
      ${seal({ label: statusLabel(a.status), group: statusGroup(a.status), size: 104 })}
    </footer>
  </article>`;
}

function votePanel(a) {
  const ayes = a.votes_for ?? 0, noes = a.votes_against ?? 0, abs = a.votes_abstain ?? 0;
  if (!ayes && !noes && !abs) return '';
  return `<section class="panel vote">
    <h2>The division</h2>
    ${hemicycle([
      { count: ayes, color: '#3d7d52', label: 'ayes' },
      { count: abs, color: '#c9a465', label: 'abstentions' },
      { count: noes, color: '#b8352b', label: 'noes' },
    ])}
    <div class="vote-legend">
      <div><b>${ayes}</b><i style="background:#3d7d52"></i>Ayes</div>
      <div><b>${noes}</b><i style="background:#b8352b"></i>Noes</div>
      <div><b>${abs}</b><i style="background:#c9a465"></i>Abstained</div>
    </div>
    <p class="verdict" style="color:${ayes > noes ? 'var(--green-700)' : 'var(--red-700)'}">${ayes > noes ? 'The ayes have it' : ayes === noes ? 'The House is tied' : 'The noes have it'}</p>
  </section>`;
}

export async function render(main, { params, isCurrent }) {
  main.innerHTML = loading();
  const a = await api.getAct(decodeURIComponent(params[0]));
  if (!isCurrent()) return;
  if (!a) {
    setTitle('Act not found');
    main.innerHTML = `<section class="section paper"><div class="container">${emptyState('This act is not in the Register', 'It may have been withdrawn from publication, or the link is mistyped.', `<a class="btn btn-line" href="${to('')}">Open the Register</a>`)}</div></section>`;
    return;
  }
  setTitle(a.title);
  const hasText = !!(a.body && a.body.trim());
  const pdfUrl = a.pdf_path ? api.publicUrl(a.pdf_path) : null;
  const { toc } = renderText(a.body || '');
  const m = currentMember();

  const rows = [
    ['Reference', esc(reference(a))],
    ['Type', esc(kindLabel(a.kind))],
    ['Status', statusPill(a.status)],
    a.parties?.length ? ['Parties', `The Republic of Milan and ${a.parties.map(esc).join(', ')}`] : null,
    a.sponsor ? ['Sponsor', esc(a.sponsor)] : null,
    a.introduced_on ? ['Introduced', fmtDate(a.introduced_on)] : null,
    a.passed_on ? ['Passed', fmtDate(a.passed_on)] : null,
    a.effective_on ? ['In force', fmtDate(a.effective_on)] : null,
    a.expires_on ? ['Expires', fmtDate(a.expires_on)] : null,
  ].filter(Boolean);

  main.innerHTML = `
  <section class="hero dark act-hero" aria-labelledby="act-title">
    <div class="container hero-inner">
      <div>
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${to('')}">The Register</a><span aria-hidden="true">/</span><a href="${to(`?type=${a.kind}`)}">${esc(kindLabel(a.kind))}</a><span aria-hidden="true">/</span><span>No. <span class="n">${a.number}</span></span></nav>
        <p class="eyebrow">${icon(a.kind === 'treaty' ? 'handshake' : 'scroll')}<span>${refHtml(a)}</span></p>
        <h1 id="act-title">${esc(a.title)}</h1>
        ${a.subtitle ? `<p class="lede">${esc(a.subtitle)}</p>` : ''}
        ${partyChips(a.parties)}
      </div>
      ${seal({ label: statusLabel(a.status), group: statusGroup(a.status), size: 150 })}
    </div>
  </section>
  <div class="container act-layout">
    <div>
      ${a.summary ? `<section class="brief"><p class="kicker plain">In brief</p><p>${esc(a.summary)}</p></section>` : ''}
      ${hasText && pdfUrl ? `<div class="tabs" role="tablist">
        <button class="tab" role="tab" type="button" aria-selected="true" data-tab="text">${icon('file')} Official text</button>
        <button class="tab" role="tab" type="button" aria-selected="false" data-tab="pdf">${icon('maximize')} Original document</button>
      </div>` : ''}
      <div id="tab-text"${hasText ? '' : ' hidden'}>${hasText ? docSheet(a, a.body) : ''}</div>
      <div id="tab-pdf"${hasText ? ' hidden' : ''}>
        ${pdfUrl ? `<div class="pdf-bar"><span>${esc(a.pdf_name || 'Original document')}${a.pdf_pages ? `, ${a.pdf_pages} ${a.pdf_pages === 1 ? 'page' : 'pages'}` : ''}${a.pdf_size ? `, ${fmtBytes(a.pdf_size)}` : ''}</span><a class="btn btn-xs btn-line" href="${pdfUrl}" target="_blank" rel="noopener">${icon('maximize')} Open full size</a></div><div class="pdf-viewer" id="pdf"></div>`
          : !hasText ? emptyState('No text yet', 'The text of this act has not been entered yet.') : ''}
      </div>
    </div>
    <aside class="aside">
      <section class="panel">
        <h2>Particulars</h2>
        <dl class="particulars">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      </section>
      <section class="panel actions">
        ${pdfUrl ? `<a class="btn btn-red" href="${pdfUrl}" download="${esc(a.pdf_name || `${a.slug}.pdf`)}">${icon('download')} Download PDF</a>` : ''}
        <button class="btn btn-line" type="button" id="copy">${icon('link')} Copy link</button>
        ${hasText ? `<button class="btn btn-line" type="button" id="print">${icon('printer')} Print</button>` : ''}
        ${m ? `<a class="btn btn-green" href="${to(`/portal/edit/${a.id}`)}">${icon('pencil')} Edit this act</a>` : ''}
      </section>
      ${toc.length > 2 ? `<section class="panel"><h2>Contents</h2><ol class="toc">${toc.map((t) => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></section>` : ''}
      ${votePanel(a)}
      ${a.events?.length ? `<section class="panel"><h2>Passage</h2><ol class="timeline">${a.events.map((e) => `
        <li><time datetime="${e.happened_on}">${fmtDate(e.happened_on)}</time><strong>${esc(e.label)}</strong>${e.detail ? `<p>${esc(e.detail)}</p>` : ''}${e.member_name ? `<p>Recorded by ${esc(e.member_name)}</p>` : ''}</li>`).join('')}
      </ol></section>` : ''}
    </aside>
  </div>`;

  let unmountPdf = null;
  const showPdf = async () => {
    if (unmountPdf || !pdfUrl) return;
    const { mountViewer } = await import('../pdf.js');
    if (!isCurrent()) return;
    unmountPdf = await mountViewer(main.querySelector('#pdf'), pdfUrl);
  };
  if (!hasText) showPdf();

  main.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    const which = tab.dataset.tab;
    main.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    main.querySelector('#tab-text').hidden = which !== 'text';
    main.querySelector('#tab-pdf').hidden = which !== 'pdf';
    if (which === 'pdf') showPdf();
  }));

  main.querySelector('#copy').addEventListener('click', async () => {
    const ok = await copyText(`${location.origin}${to(`/acts/${a.slug}`)}`);
    toast(ok ? 'Link copied. Paste it anywhere, including Discord.' : 'Could not copy the link.', ok ? 'ok' : 'error');
  });
  main.querySelector('#print')?.addEventListener('click', () => {
    main.querySelector('.tab[data-tab="text"]')?.click();
    window.print();
  });

  let observer = null;
  const links = [...main.querySelectorAll('.toc a')];
  if (links.length) {
    const byId = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((l) => l.classList.remove('on'));
        byId.get(e.target.id)?.classList.add('on');
      }
    }, { rootMargin: '-20% 0px -70% 0px' });
    toc.forEach((t) => { const el = document.getElementById(t.id); if (el) observer.observe(el); });
  }

  return () => {
    observer?.disconnect();
    unmountPdf?.();
  };
}
