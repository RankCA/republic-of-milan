// The official text format MPs write acts in, and its typeset rendering.
//
//   # 1. Trade              section heading
//   ## Annex A: Spheres     annex or sub-heading
//   1.1 Both states ...     numbered clause
//   - Bullet point          bullet
//   > Translation           translation of the line above
//   | State | Sphere |      table row (first row is the header)
//   President ______        signature line
//   ---                     horizontal rule
//   **bold**  *italic*
//   \# not a heading     a backslash keeps a line (or * | _) as plain text
//
// Lines that start with none of these continue the block above, so text pasted
// from a PDF with hard line breaks still flows into clean paragraphs.

import { esc } from './util.js';

const RX = {
  h1: /^#\s+(.+)$/,
  h2: /^##\s+(.+)$/,
  clause: /^(\d+(?:\.\d+)+)\.?\s+(.+)$/,
  article: /^(Article\s+\d+[a-z]?)\.?\s*[:.]?\s+(.+)$/i,
  bullet: /^[-*•▪●·]\s+(.+)$/,
  tr: /^>\s?(.*)$/,
  row: /^\|(.+)\|?\s*$/,
  sign: /^(.*?)[\s:]*_{3,}\s*$/,
  rule: /^(-{3,}|\*{3,})$/,
};

export function slugId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parse(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let last = null;
  const push = (b) => { blocks.push(b); last = b; return b; };

  for (const raw of lines) {
    let line = raw.trim();
    if (!line) { last = null; continue; }
    let m;
    // A leading backslash keeps the line as plain text: \# 1 is not a heading.
    const literal = /^\\[#>|\-\u2022\u25AA\u25CF\u00B7\dAa]/.test(line);
    if (literal) line = line.slice(1);
    if (!literal) {
    if ((m = line.match(RX.h2))) { push({ type: 'h2', text: m[1].trim() }); continue; }
    if ((m = line.match(RX.h1))) { push({ type: 'h1', text: m[1].trim() }); continue; }
    if (RX.rule.test(line)) { push({ type: 'rule' }); last = null; continue; }
    if ((m = line.match(RX.tr))) {
      if (last && last.type !== 'table' && last.type !== 'rule' && last.type !== 'sign') {
        last.tr = last.tr ? `${last.tr} ${m[1]}` : m[1];
      } else {
        push({ type: 'p', text: '', tr: m[1] });
      }
      last.trOpen = true;
      continue;
    }
    if (line.startsWith('|') && (m = line.match(RX.row))) {
      const cells = m[1].replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (last && last.type === 'table') last.rows.push(cells);
      else push({ type: 'table', rows: [cells] });
      continue;
    }
    if ((m = line.match(RX.sign))) {
      const label = m[1].trim();
      if (last && last.type === 'sign') last.lines.push(label);
      else push({ type: 'sign', lines: [label] });
      continue;
    }
    if ((m = line.match(RX.clause))) { push({ type: 'clause', no: m[1], text: m[2] }); continue; }
    if ((m = line.match(RX.article))) { push({ type: 'clause', no: m[1], text: m[2], article: true }); continue; }
    if ((m = line.match(RX.bullet))) { push({ type: 'li', text: m[1] }); continue; }
    }
    // Continuation of the block above, if it holds running text.
    if (last && last.trOpen) {
      last.tr = `${last.tr} ${line}`;
      continue;
    }
    if (last && ['p', 'clause', 'li'].includes(last.type)) {
      last.text = last.text ? `${last.text} ${line}` : line;
      continue;
    }
    push({ type: 'p', text: line });
  }
  return blocks;
}

function anchors(blocks) {
  const ids = new Set();
  for (const b of blocks) {
    if (b.type === 'h1') {
      const n = b.text.match(/^(\d+)[.)]?\s/);
      b.id = n ? `s-${n[1]}` : `s-${slugId(b.text)}`;
    } else if (b.type === 'h2') {
      const a = b.text.match(/^(annex|schedule|appendix)\s+([a-z0-9]+)/i);
      b.id = a ? `${a[1].toLowerCase()}-${a[2].toLowerCase()}` : `s-${slugId(b.text)}`;
    } else if (b.type === 'clause') {
      b.id = `c-${slugId(b.no)}`;
    }
    if (b.id) {
      let id = b.id, k = 2;
      while (ids.has(id)) id = `${b.id}-${k++}`;
      b.id = id;
      ids.add(id);
    }
  }
  return ids;
}

// Backslash escapes (\* \_ \| \\) become character references so they are never read as markup.
const unescape = (s) => s.replace(/\\([\\*_|#])/g, (_, c) => `&#${c.charCodeAt(0)};`);

function inline(text, ids) {
  let s = unescape(esc(text));
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  if (ids) {
    s = s.replace(/\b(Sections?|Clauses?|Articles?)\s+(\d+(?:\.\d+)*)/g, (all, word, num) => {
      const id = num.includes('.') ? `c-${slugId(num)}` : `s-${num}`;
      return ids.has(id) ? `<a class="xref" href="#${id}">${word} ${num}</a>` : all;
    });
    s = s.replace(/\b(Annex|Schedule|Appendix)\s+([A-Z0-9])\b/g, (all, word, key) => {
      const id = `${word.toLowerCase()}-${key.toLowerCase()}`;
      return ids.has(id) ? `<a class="xref" href="#${id}">${word} ${key}</a>` : all;
    });
  }
  return s;
}

// Leading numbers in headings ("1. Trade") get their own span for styling.
const numbered = (html) => html.replace(/^(\d+(?:\.\d+)*\.?)(\s)/, '<span class="n">$1</span>$2');

const trHtml = (b, ids) => (b.tr ? `<span class="tr" lang="">${inline(b.tr, ids)}</span>` : '');

/** Render the official text. Returns { html, toc }. */
export function render(src) {
  const blocks = parse(src);
  const ids = anchors(blocks);
  const out = [];
  const toc = [];
  let list = null;
  let leadDone = false;
  const closeList = () => { if (list) { out.push('</ul>'); list = null; } };

  for (const b of blocks) {
    if (b.type !== 'li') closeList();
    if (b.type === 'h1' || b.type === 'h2') leadDone = true;
    switch (b.type) {
      case 'h1':
        toc.push({ id: b.id, text: b.text, level: 1, tr: b.tr });
        out.push(`<h2 class="doc-h1" id="${b.id}">${numbered(inline(b.text))}${b.tr ? ` <span class="h-tr">${inline(b.tr)}</span>` : ''}</h2>`);
        break;
      case 'h2':
        toc.push({ id: b.id, text: b.text, level: 2, tr: b.tr });
        out.push(`<h3 class="doc-h2" id="${b.id}">${inline(b.text)}${b.tr ? ` <span class="h-tr">${inline(b.tr)}</span>` : ''}</h3>`);
        break;
      case 'clause':
        out.push(`<div class="clause${b.article ? ' article' : ''}" id="${b.id}"><a class="clause-no" href="#${b.id}">${esc(b.no)}</a><p>${inline(b.text, ids)}${trHtml(b, ids)}</p></div>`);
        break;
      case 'li':
        if (!list) { out.push('<ul class="doc-list">'); list = true; }
        out.push(`<li>${inline(b.text, ids)}${trHtml(b, ids)}</li>`);
        break;
      case 'table': {
        const [head, ...rows] = b.rows;
        const width = Math.max(...b.rows.map((r) => r.length));
        const cells = (r, tag) => Array.from({ length: width }, (_, i) => `<${tag}>${inline(r[i] ?? '', ids)}</${tag}>`).join('');
        out.push(`<div class="doc-table-wrap"><table class="doc-table"><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table></div>`);
        break;
      }
      case 'sign':
        out.push(`<div class="sign-block">${b.lines.map((l) => `<div class="sign-line"><span>${inline(l)}</span><i></i></div>`).join('')}</div>`);
        break;
      case 'rule':
        out.push('<hr class="doc-rule">');
        break;
      default: {
        const lead = !leadDone && b.text && !/^[*>]/.test(b.text) && /^[A-Za-z]/.test(b.text);
        if (lead) leadDone = true;
        out.push(`<p class="doc-p${lead ? ' first' : ''}">${inline(b.text, ids)}${trHtml(b, ids)}</p>`);
      }
    }
  }
  closeList();
  return { html: out.join('\n'), toc };
}

/** Turn text pulled out of a PDF into a first draft in the official text format. */
export function draftFromPdfText(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  // Drop running headers and footers: short lines that repeat, or page counters.
  const counts = new Map();
  for (const l of lines) if (l) counts.set(l, (counts.get(l) || 0) + 1);
  const out = [];
  for (const l of lines) {
    if (!l) { out.push(''); continue; }
    if (/\bpage\s+\d+(\s*(of|\/)\s*\d+)?\b/i.test(l) && l.length < 140) continue;
    if (/sayfa\s+\d+/i.test(l) && l.length < 140) continue;
    if (counts.get(l) > 2 && l.length < 80 && !RX.sign.test(l)) continue;
    if (/^[▪•●·]$/.test(l)) continue;
    let m;
    if ((m = l.match(/^[•▪●·–-]\s*(.+)$/))) { out.push(`- ${m[1]}`); continue; }
    if (/^\d+\.\s+\S/.test(l) && l.length <= 80 && !/[.;:,]$/.test(l)) { out.push('', `# ${l}`); continue; }
    if (/^(annex|schedule|appendix)\b/i.test(l) && l.length <= 80) { out.push('', `## ${l}`); continue; }
    if (/^(signatures?|signed)$/i.test(l)) { out.push('', `## ${l}`); continue; }
    if (/^(article\s+\d+)/i.test(l) && l.length <= 80 && !/[.;,]$/.test(l)) { out.push('', `# ${l}`); continue; }
    if (/_{3,}/.test(l)) { out.push(l.replace(/_{3,}.*$/, '______')); continue; }
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
