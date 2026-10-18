// A small word processor for acts. You edit the page itself, as in a word
// processor; underneath, the text is kept as the Register's Markdown.
//
// The page is one contenteditable element whose children are blocks:
//   p (normal text), section (numbered heading), heading (unnumbered, centred),
//   clause (numbered 1.1, 1.2 under its section), bullet, tr (translation of the
//   line above), sign (signature line), rule (divider) and table.
// Section and clause numbers are worked out from the order of the blocks and
// drawn with CSS, so they never get in the way of typing.

import { parse } from './markup.js';
import { esc } from './util.js';

export const STYLES = {
  p: { label: 'Normal text', tag: 'p' },
  section: { label: 'Section', tag: 'h2' },
  heading: { label: 'Heading', tag: 'h3' },
  clause: { label: 'Clause', tag: 'p' },
  bullet: { label: 'Bullet point', tag: 'p' },
  tr: { label: 'Translation', tag: 'p' },
  sign: { label: 'Signature line', tag: 'p' },
};
const TEXT_TYPES = new Set(Object.keys(STYLES));
const AFTER_ENTER = { p: 'p', section: 'p', heading: 'p', clause: 'clause', bullet: 'bullet', sign: 'sign' };

// Inline Markdown <-> HTML -------------------------------------------------------

function inlineToHtml(text) {
  let s = esc(text || '').replace(/\\([\\*_|#])/g, (_, c) => `&#${c.charCodeAt(0)};`);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>');
  return s;
}

const wrap = (inner, mark) => {
  if (!inner.trim()) return inner;
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
};

function inlineToMd(node, { cell = false } = {}) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) {
      out += n.nodeValue.replace(/ /g, ' ').replace(cell ? /[\\*|]/g : /[\\*]/g, '\\$&');
    } else if (n.nodeType === 1) {
      const tag = n.tagName;
      const st = n.style || {};
      if (tag === 'BR') out += ' ';
      else if (tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(st.fontWeight)) out += wrap(inlineToMd(n, { cell }), '**');
      else if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') out += wrap(inlineToMd(n, { cell }), '*');
      else out += inlineToMd(n, { cell });
    }
  }
  return out.replace(/\*\*\*\*/g, '').replace(/[ \t]+/g, ' ');
}

// Stop plain text from being read back as markup.
function guardLine(text) {
  let t = text.replace(/_{3,}/g, (u) => u.replace(/_/g, '\\_'));
  if (/^(#|>|\||[-*•▪●·]\s|\d+(\.\d+)+\.?\s|article\s+\d|-{3,}$)/i.test(t)) t = `\\${t}`;
  return t;
}

// Editor -------------------------------------------------------------------------

export function createEditor(root, { markdown = '', onChange = () => {}, onState = () => {} } = {}) {
  root.classList.add('wp-body');
  root.contentEditable = 'true';
  root.spellcheck = true;
  try { document.execCommand('styleWithCSS', false, false); } catch { /* old browsers */ }

  // Blocks ---------------------------------------------------------------------
  const blocks = () => [...root.children];
  const typeOf = (el) => el?.dataset?.b || 'p';
  const isText = (el) => TEXT_TYPES.has(typeOf(el));

  function makeBlock(type, html = '') {
    const el = document.createElement(STYLES[type].tag);
    el.dataset.b = type;
    el.innerHTML = html || '<br>';
    return el;
  }
  function makeRule() {
    const el = document.createElement('hr');
    el.dataset.b = 'rule';
    el.contentEditable = 'false';
    return el;
  }
  function makeTable(rows) {
    const wrapEl = document.createElement('div');
    wrapEl.dataset.b = 'table';
    wrapEl.className = 'wp-table';
    wrapEl.contentEditable = 'false';
    const width = Math.max(1, ...rows.map((r) => r.length));
    const cells = (r, tag) => Array.from({ length: width }, (_, i) => `<${tag} contenteditable="true">${inlineToHtml(r[i] ?? '')}</${tag}>`).join('');
    const [head, ...body] = rows;
    wrapEl.innerHTML = `
      <div class="wp-table-tools" aria-label="Table">
        <button type="button" data-t="row">+ Row</button><button type="button" data-t="col">+ Column</button>
        <button type="button" data-t="delrow">Remove row</button><button type="button" data-t="delcol">Remove column</button>
        <button type="button" data-t="deltable" class="danger">Delete table</button>
      </div>
      <table><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${(body.length ? body : [[]]).map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table>`;
    return wrapEl;
  }

  function renumber() {
    let sec = 0, cl = 0;
    for (const el of blocks()) {
      const t = typeOf(el);
      if (t === 'section') {
        sec++; cl = 0;
        el.dataset.no = `${sec}.`;
      } else if (t === 'clause') {
        cl++;
        el.dataset.no = sec ? `${sec}.${cl}` : `Article ${cl}`;
      }
    }
    root.classList.toggle('is-empty', blocks().length === 1 && typeOf(root.firstElementChild) === 'p' && !root.textContent.trim());
  }

  // Markdown in --------------------------------------------------------------------
  function build(md) {
    const nodes = [];
    for (const b of parse(md)) {
      let el = null;
      if (b.type === 'h1') {
        const m = b.text.match(/^(\d+)[.)]\s+(.*)$/);
        el = makeBlock('section', inlineToHtml(m ? m[2] : b.text));
      } else if (b.type === 'h2') el = makeBlock('heading', inlineToHtml(b.text));
      else if (b.type === 'clause') el = makeBlock('clause', inlineToHtml(b.text));
      else if (b.type === 'li') el = makeBlock('bullet', inlineToHtml(b.text));
      else if (b.type === 'p') el = b.text ? makeBlock('p', inlineToHtml(b.text)) : null;
      else if (b.type === 'table') el = makeTable(b.rows);
      else if (b.type === 'rule') el = makeRule();
      else if (b.type === 'sign') { for (const l of b.lines) nodes.push(makeBlock('sign', inlineToHtml(l))); }
      if (el) nodes.push(el);
      if (b.tr) nodes.push(makeBlock('tr', inlineToHtml(b.tr)));
    }
    return nodes;
  }
  function load(md) {
    root.replaceChildren(...build(md));
    if (!root.firstElementChild || !isText(root.lastElementChild)) root.append(makeBlock('p'));
    renumber();
  }

  // Markdown out -------------------------------------------------------------------
  function serialize() {
    renumber();
    const out = [];
    let prev = null;
    for (const el of blocks()) {
      const t = typeOf(el);
      let line = null;
      if (t === 'rule') line = '---';
      else if (t === 'table') {
        const rows = [...el.querySelectorAll('tr')].map((tr) => `| ${[...tr.children].map((c) => inlineToMd(c, { cell: true }).trim() || ' ').join(' | ')} |`);
        if (rows.length) {
          const width = el.querySelector('tr').children.length;
          rows.splice(1, 0, `| ${Array(width).fill('---').join(' | ')} |`);
          line = rows.join('\n');
        }
      } else {
        const text = inlineToMd(el).trim();
        if (t === 'sign') line = text ? `${text.replace(/_{3,}/g, (u) => u.replace(/_/g, '\\_'))} ______` : '______';
        else if (!text) line = null;
        else if (t === 'section') line = `# ${el.dataset.no} ${text}`;
        else if (t === 'heading') line = `## ${text}`;
        else if (t === 'clause') line = `${el.dataset.no} ${text.replace(/_{3,}/g, (u) => u.replace(/_/g, '\\_'))}`;
        else if (t === 'bullet') line = `- ${text.replace(/_{3,}/g, (u) => u.replace(/_/g, '\\_'))}`;
        else if (t === 'tr') line = `> ${text}`;
        else line = guardLine(text);
      }
      if (line == null) continue;
      const glue = (t === 'tr' && prev && prev !== 'table' && prev !== 'rule' && prev !== 'sign') || (t === 'sign' && prev === 'sign') ? '\n' : '\n\n';
      out.push(out.length ? glue + line : line);
      prev = t;
    }
    return out.join('').trim();
  }

  // Caret helpers --------------------------------------------------------------------
  const blockOf = (node) => {
    while (node && node.parentNode !== root) node = node.parentNode;
    return node && node.parentNode === root ? node : null;
  };
  const cellOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('th, td') || null;

  function offsetIn(el, node, off) {
    const r = document.createRange();
    r.selectNodeContents(el);
    try { r.setEnd(node, off); } catch { return 0; }
    return r.toString().length;
  }
  function pointAt(el, offset) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let acc = 0, n, last = null;
    while ((n = walker.nextNode())) {
      last = n;
      if (acc + n.nodeValue.length >= offset) return [n, offset - acc];
      acc += n.nodeValue.length;
    }
    return last ? [last, last.nodeValue.length] : [el, 0];
  }
  function setCaret(el, offset = 0, endOffset = null) {
    const sel = getSelection();
    const r = document.createRange();
    const [n, o] = pointAt(el, offset);
    r.setStart(n, o);
    if (endOffset != null) { const [n2, o2] = pointAt(el, endOffset); r.setEnd(n2, o2); } else r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function caret() {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.startContainer)) return null;
    const block = blockOf(r.startContainer);
    if (!block) return null;
    return { r, block, cell: cellOf(r.startContainer), offset: offsetIn(block, r.startContainer, r.startOffset), collapsed: r.collapsed };
  }
  function saveSel() {
    const sel = getSelection();
    if (!sel.rangeCount || !root.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0);
    const a = blockOf(r.startContainer), b = blockOf(r.endContainer);
    if (!a || !b) return null;
    const all = blocks();
    return { a: all.indexOf(a), ao: offsetIn(a, r.startContainer, r.startOffset), b: all.indexOf(b), bo: offsetIn(b, r.endContainer, r.endOffset) };
  }
  function restoreSel(s) {
    if (!s) return;
    const all = blocks();
    const a = all[Math.min(s.a, all.length - 1)], b = all[Math.min(s.b, all.length - 1)];
    if (!a || !b || !isText(a) || !isText(b)) { if (a && isText(a)) setCaret(a, 0); return; }
    const sel = getSelection();
    const r = document.createRange();
    const [n1, o1] = pointAt(a, s.ao);
    const [n2, o2] = pointAt(b, s.bo);
    r.setStart(n1, o1);
    r.setEnd(n2, o2);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  // Remember the last place the caret was, so toolbar buttons act on it.
  let lastSel = null;
  function ensureSel() {
    if (caret()) return true;
    root.focus({ preventScroll: true });
    if (lastSel) restoreSel(lastSel);
    else { const el = blocks().find(isText); if (el) setCaret(el, 0); }
    return !!caret();
  }

  function selectedBlocks() {
    const sel = getSelection();
    if (!sel.rangeCount) return [];
    const r = sel.getRangeAt(0);
    const a = blockOf(r.startContainer), b = blockOf(r.endContainer);
    if (!a) return [];
    const all = blocks();
    return all.slice(all.indexOf(a), all.indexOf(b || a) + 1);
  }

  // History --------------------------------------------------------------------------
  let stack = [];
  let index = -1;
  let typingTimer = null;
  function commit() {
    clearTimeout(typingTimer);
    typingTimer = null;
    const md = serialize();
    const sel = saveSel();
    if (stack[index]?.md === md) { if (stack[index]) stack[index].sel = sel; return; }
    stack = stack.slice(0, index + 1);
    stack.push({ md, sel });
    if (stack.length > 300) stack.shift();
    index = stack.length - 1;
  }
  function flush() { if (typingTimer) commit(); }
  function travel(step) {
    flush();
    const next = index + step;
    if (next < 0 || next >= stack.length) return;
    index = next;
    load(stack[index].md);
    restoreSel(stack[index].sel || { a: 0, ao: 0, b: 0, bo: 0 });
    emitChange(false);
  }

  function emitChange(record = true) {
    renumber();
    if (record) { clearTimeout(typingTimer); typingTimer = setTimeout(commit, 500); }
    onChange();
    reportState();
  }

  // Structure edits --------------------------------------------------------------------
  function convert(block, type) {
    if (!isText(block) || typeOf(block) === type) return block;
    const tag = STYLES[type].tag;
    let el = block;
    if (block.tagName.toLowerCase() !== tag) {
      el = document.createElement(tag);
      el.append(...block.childNodes);
      block.replaceWith(el);
    }
    el.dataset.b = type;
    el.removeAttribute('data-no');
    if (!el.firstChild) el.innerHTML = '<br>';
    return el;
  }

  /** Apply a style to the selected blocks. Applying the style they already have turns them back into normal text. */
  function setStyle(type) {
    ensureSel();
    flush();
    const sel = saveSel();
    const targets = selectedBlocks().filter(isText);
    if (!targets.length) return;
    const all = targets.every((b) => typeOf(b) === type);
    for (const b of targets) convert(b, all && type !== 'p' ? 'p' : type);
    restoreSel(sel);
    commit();
    emitChange(false);
  }

  function insertAfterCurrent(el, { focusInside = false } = {}) {
    ensureSel();
    flush();
    const c = caret();
    let at = c?.block || root.lastElementChild;
    if (at && isText(at) && !at.textContent.trim() && typeOf(at) === 'p') {
      at.replaceWith(el);
    } else if (at) at.after(el);
    else root.append(el);
    let next = el.nextElementSibling;
    if (!next || !isText(next)) { next = makeBlock('p'); el.after(next); }
    const firstCell = focusInside && el.querySelector('[contenteditable="true"]');
    if (firstCell) { firstCell.focus(); setCaret(firstCell, 0, firstCell.textContent.length); }
    else setCaret(next, 0);
    commit();
    emitChange(false);
  }

  const insertTable = () => insertAfterCurrent(makeTable([['Column 1', 'Column 2'], ['', ''], ['', '']]), { focusInside: true });
  const insertRule = () => insertAfterCurrent(makeRule());
  function insertSignatures() {
    ensureSel();
    flush();
    const c = caret();
    const at = c?.block || root.lastElementChild;
    const els = [makeBlock('p', '<b>For the Republic of Milan</b>'), makeBlock('sign', 'President'), makeBlock('sign', 'Minister of Foreign Affairs'), makeBlock('sign', 'Date')];
    if (at && isText(at) && !at.textContent.trim()) at.replaceWith(...els);
    else if (at) at.after(...els);
    else root.append(...els);
    const last = els[els.length - 1];
    if (!last.nextElementSibling) last.after(makeBlock('p'));
    setCaret(els[0], 0, els[0].textContent.length);
    commit();
    emitChange(false);
  }

  function splitBlock() {
    const c = caret();
    if (!c || !isText(c.block)) return;
    flush();
    let { block } = c;
    const t = typeOf(block);
    c.r.deleteContents();
    const text = block.textContent;
    if (['bullet', 'clause', 'tr', 'sign'].includes(t) && !text.trim()) {
      block = convert(block, 'p');
      setCaret(block, 0);
      commit();
      emitChange(false);
      return;
    }
    if (t === 'p' && /^-{3,}$/.test(text.trim())) {
      const rule = makeRule();
      const p = makeBlock('p');
      block.replaceWith(rule);
      rule.after(p);
      setCaret(p, 0);
      commit();
      emitChange(false);
      return;
    }
    const offset = offsetIn(block, getSelection().getRangeAt(0).startContainer, getSelection().getRangeAt(0).startOffset);
    let nextType = AFTER_ENTER[t];
    if (t === 'tr') {
      const before = block.previousElementSibling;
      nextType = AFTER_ENTER[typeOf(before)] || 'p';
    }
    if (offset === 0 && text.length) {
      const above = makeBlock(['bullet', 'clause', 'sign'].includes(t) ? t : 'p');
      block.before(above);
      setCaret(block, 0);
    } else {
      const r = getSelection().getRangeAt(0);
      const tail = document.createRange();
      tail.setStart(r.startContainer, r.startOffset);
      tail.setEnd(block, block.childNodes.length);
      const frag = tail.extractContents();
      const nb = makeBlock(nextType);
      nb.innerHTML = '';
      nb.append(frag);
      for (const x of nb.querySelectorAll('b,i,strong,em')) if (!x.textContent) x.remove();
      if (!nb.textContent) nb.innerHTML = '<br>';
      if (!block.textContent) block.innerHTML = '<br>';
      block.after(nb);
      setCaret(nb, 0);
    }
    commit();
    emitChange(false);
  }

  function mergeBackward(block) {
    const prev = block.previousElementSibling;
    if (!prev) return;
    flush();
    if (!isText(prev)) {
      if (typeOf(prev) === 'rule') prev.remove();
      else if (!block.textContent.trim()) { block.remove(); const cell = prev.querySelector('tbody tr:last-child [contenteditable="true"]:last-child'); if (cell) setCaret(cell, cell.textContent.length); }
      commit();
      emitChange(false);
      return;
    }
    const len = prev.textContent.length;
    if (!prev.textContent) prev.innerHTML = '';
    if (block.textContent) prev.append(...block.childNodes);
    block.remove();
    if (!prev.firstChild) prev.innerHTML = '<br>';
    prev.querySelectorAll('br').forEach((br) => { if (prev.textContent) br.remove(); });
    setCaret(prev, len);
    commit();
    emitChange(false);
  }

  function mergeForward(block) {
    const next = block.nextElementSibling;
    if (!next) return;
    flush();
    if (!isText(next)) {
      if (typeOf(next) === 'rule') next.remove();
      commit();
      emitChange(false);
      return;
    }
    const len = block.textContent.length;
    if (!block.textContent) block.innerHTML = '';
    if (next.textContent) block.append(...next.childNodes);
    next.remove();
    if (!block.firstChild) block.innerHTML = '<br>';
    setCaret(block, len);
    commit();
    emitChange(false);
  }

  // Tables ---------------------------------------------------------------------------
  let lastCell = null;
  function tableOp(op, tableEl) {
    flush();
    const cell = lastCell && tableEl.contains(lastCell) ? lastCell : tableEl.querySelector('th, td');
    const row = cell.parentElement;
    const col = [...row.children].indexOf(cell);
    const rows = [...tableEl.querySelectorAll('tr')];
    const width = rows[0].children.length;
    if (op === 'row') {
      const tbody = tableEl.querySelector('tbody');
      const tr = document.createElement('tr');
      tr.innerHTML = Array(width).fill('<td contenteditable="true"></td>').join('');
      if (row.parentElement === tbody) row.after(tr); else tbody.prepend(tr);
      setCaret(tr.children[Math.max(0, col)], 0);
    } else if (op === 'col') {
      for (const tr of rows) {
        const tag = tr.parentElement.tagName === 'THEAD' ? 'th' : 'td';
        const c = document.createElement(tag);
        c.contentEditable = 'true';
        if (tag === 'th') c.textContent = `Column ${width + 1}`;
        tr.children[col].after(c);
      }
      setCaret(row.children[col + 1], 0);
    } else if (op === 'delrow') {
      const body = [...tableEl.querySelectorAll('tbody tr')];
      if (row.parentElement.tagName === 'THEAD') { [...row.children].forEach((c) => (c.textContent = '')); }
      else if (body.length > 1) { const target = row.nextElementSibling || row.previousElementSibling; row.remove(); setCaret(target.children[Math.min(col, target.children.length - 1)], 0); }
      else [...row.children].forEach((c) => (c.textContent = ''));
    } else if (op === 'delcol') {
      if (width > 1) for (const tr of rows) tr.children[col].remove();
      setCaret(row.children[Math.min(col, row.children.length - 1)], 0);
    } else if (op === 'deltable') {
      const next = tableEl.nextElementSibling;
      tableEl.remove();
      if (!root.firstElementChild) root.append(makeBlock('p'));
      setCaret(next && isText(next) ? next : root.firstElementChild, 0);
    }
    commit();
    emitChange(false);
  }
  // Like a word processor, moving into a cell selects what is in it.
  function selectCell(cell) {
    cell.focus();
    setCaret(cell, 0, cell.textContent.length);
    lastCell = cell;
  }
  function moveInTable(cell, dir) {
    const tableEl = cell.closest('[data-b="table"]');
    const all = [...tableEl.querySelectorAll('th, td')];
    let i = all.indexOf(cell) + dir;
    if (dir === 'down') {
      const row = cell.parentElement;
      const col = [...row.children].indexOf(cell);
      let next = row.nextElementSibling || (row.parentElement.tagName === 'THEAD' ? tableEl.querySelector('tbody tr') : null);
      if (!next) { lastCell = cell; tableOp('row', tableEl); return; }
      selectCell(next.children[col]);
      return;
    }
    if (i >= all.length) { lastCell = cell; tableOp('row', tableEl); const rows = tableEl.querySelectorAll('tbody tr'); selectCell(rows[rows.length - 1].children[0]); return; }
    if (i < 0) i = 0;
    selectCell(all[i]);
  }

  // Cleaning up what the browser inserts --------------------------------------------------
  function normalize() {
    let dirty = false;
    for (const n of [...root.childNodes]) {
      if (n.nodeType === 1 && n.dataset.b && (TEXT_TYPES.has(n.dataset.b) || n.dataset.b === 'rule' || n.dataset.b === 'table')) continue;
      dirty = true;
      break;
    }
    if (!dirty) {
      for (const b of blocks()) if (isText(b) && b.querySelector('div,p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,span,font,a,table,img')) { dirty = true; break; }
    }
    if (!dirty) return;
    const sel = saveSel();
    for (const n of [...root.childNodes]) {
      if (n.nodeType === 3) {
        if (!n.nodeValue.trim()) { n.remove(); continue; }
        const p = makeBlock('p');
        p.innerHTML = '';
        n.replaceWith(p);
        p.append(n);
      } else if (n.nodeType === 1 && !(n.dataset.b && (TEXT_TYPES.has(n.dataset.b) || n.dataset.b === 'rule' || n.dataset.b === 'table'))) {
        if (n.tagName === 'BR') { n.remove(); continue; }
        const p = makeBlock('p');
        p.innerHTML = '';
        n.replaceWith(p);
        if (/^(DIV|P|H\d|LI|UL|OL|BLOCKQUOTE)$/.test(n.tagName)) p.append(...n.childNodes);
        else p.append(n);
        if (!p.firstChild) p.innerHTML = '<br>';
      }
    }
    for (const b of blocks()) {
      if (!isText(b)) continue;
      b.querySelectorAll('img,table').forEach((x) => x.remove());
      let found;
      while ((found = b.querySelector('div,p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,span,font,a'))) {
        const st = found.style || {};
        if (found.tagName === 'SPAN' && (/^(bold|[6-9]00)$/.test(st.fontWeight) || st.fontStyle === 'italic')) {
          const tag = /^(bold|[6-9]00)$/.test(st.fontWeight) ? 'b' : 'i';
          const x = document.createElement(tag);
          x.append(...found.childNodes);
          found.replaceWith(x);
        } else found.replaceWith(...found.childNodes);
      }
      b.removeAttribute('style');
      b.querySelectorAll('[style]').forEach((x) => x.removeAttribute('style'));
    }
    if (!root.firstElementChild) root.append(makeBlock('p'));
    restoreSel(sel);
  }

  // Markdown shortcuts while typing ("# " makes a section, and so on) ------------------
  function tryShortcut() {
    const c = caret();
    if (!c || c.cell || typeOf(c.block) !== 'p' || !c.collapsed) return false;
    const text = c.block.textContent.replace(/\u00a0/g, ' ');
    const m = text.match(/^(##|#|[-*]|>|\d+\.\d+)\s/);
    if (!m || c.offset < m[0].length) return false;
    const type = { '##': 'heading', '#': 'section', '-': 'bullet', '*': 'bullet', '>': 'tr' }[m[1]] || 'clause';
    flush();
    const r = document.createRange();
    const [n, o] = pointAt(c.block, m[0].length);
    r.setStart(c.block, 0);
    r.setEnd(n, o);
    r.deleteContents();
    const el = convert(c.block, type);
    setCaret(el, c.offset - m[0].length);
    commit();
    emitChange(false);
    return true;
  }

  // Events ------------------------------------------------------------------------------
  root.addEventListener('beforeinput', (e) => {
    const c = caret();
    const t = e.inputType;
    if (t === 'historyUndo') { e.preventDefault(); travel(-1); return; }
    if (t === 'historyRedo') { e.preventDefault(); travel(1); return; }
    if (!c) return;
    if (c.cell) {
      if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); moveInTable(c.cell, 'down'); }
      return;
    }
    if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); splitBlock(); return; }
    if (t === 'deleteContentBackward' && c.collapsed && c.offset === 0) {
      const tp = typeOf(c.block);
      e.preventDefault();
      if (tp !== 'p') { const el = convert(c.block, 'p'); setCaret(el, 0); commit(); emitChange(false); }
      else mergeBackward(c.block);
      return;
    }
    if (t === 'deleteContentForward' && c.collapsed && c.offset === c.block.textContent.length) {
      e.preventDefault();
      mergeForward(c.block);
    }
  });

  root.addEventListener('input', (e) => {
    normalize();
    if (e.inputType === 'insertText' && /\s/.test(e.data || '') && tryShortcut()) return;
    emitChange(true);
  });

  root.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const c = caret();
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); travel(e.shiftKey ? 1 : -1); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); travel(1); return; }
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); format('bold'); return; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); format('italic'); return; }
    if (mod && e.altKey && /^Digit[0-3]$/.test(e.code)) { e.preventDefault(); setStyle({ Digit0: 'p', Digit1: 'section', Digit2: 'heading', Digit3: 'clause' }[e.code]); return; }
    if (mod && e.shiftKey && e.code === 'Digit8') { e.preventDefault(); setStyle('bullet'); return; }
    if (mod && e.shiftKey && e.code === 'Digit7') { e.preventDefault(); setStyle('clause'); return; }
    if (e.key === 'Tab' && c?.cell) { e.preventDefault(); moveInTable(c.cell, e.shiftKey ? -1 : 1); return; }
    // Fallback for browsers without beforeinput on Enter.
    if (e.key === 'Enter' && !e.isComposing && !('onbeforeinput' in root)) { e.preventDefault(); if (c?.cell) moveInTable(c.cell, 'down'); else splitBlock(); }
  });

  root.addEventListener('paste', (e) => {
    const c = caret();
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    e.preventDefault();
    if (!text) return;
    if (!c || c.cell || !/\n/.test(text.trim())) {
      document.execCommand('insertText', false, c?.cell ? text.replace(/\s*\n\s*/g, ' ') : text.replace(/\s*\n\s*/g, ' '));
      return;
    }
    const pasted = build(text);
    if (!pasted.length) return;
    flush();
    c.r.deleteContents();
    const block = c.block;
    const r = getSelection().getRangeAt(0);
    const tail = document.createRange();
    tail.setStart(r.startContainer, r.startOffset);
    tail.setEnd(block, block.childNodes.length);
    const after = makeBlock(typeOf(block));
    after.innerHTML = '';
    after.append(tail.extractContents());
    block.after(...pasted);
    const lastPasted = pasted[pasted.length - 1];
    if (after.textContent.trim()) lastPasted.after(after);
    if (!block.textContent.trim() && typeOf(block) === 'p') block.remove();
    const end = pasted.filter(isText).pop();
    if (end) setCaret(end, end.textContent.length);
    commit();
    emitChange(false);
  });

  root.addEventListener('focusin', (e) => { const cell = cellOf(e.target); if (cell) lastCell = cell; });
  root.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.wp-table-tools button');
    if (btn) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.wp-table-tools button');
    if (btn) tableOp(btn.dataset.t, btn.closest('[data-b="table"]'));
  });

  function format(cmd) {
    ensureSel();
    flush();
    document.execCommand(cmd);
    normalize();
    commit();
    emitChange(false);
  }

  function reportState() {
    const c = caret();
    if (!c) return;
    let bold = false, italic = false;
    try { bold = document.queryCommandState('bold'); italic = document.queryCommandState('italic'); } catch { /* ignore */ }
    const type = c.cell ? 'table' : typeOf(c.block);
    if (type === 'section' || type === 'heading' || (c.cell && c.cell.tagName === 'TH')) bold = false;
    onState({ type, bold, italic, canUndo: index > 0, canRedo: index < stack.length - 1 });
  }
  const onSelection = () => {
    if (!root.contains(getSelection().anchorNode)) return;
    const s = saveSel();
    if (s) lastSel = s;
    reportState();
  };
  document.addEventListener('selectionchange', onSelection);

  load(markdown);
  commit();

  return {
    getMarkdown: serialize,
    setMarkdown(md) { flush(); load(md); commit(); emitChange(false); },
    focus(atEnd = false) {
      const el = atEnd ? [...blocks()].reverse().find(isText) : blocks().find(isText);
      if (el) setCaret(el, atEnd ? el.textContent.length : 0);
      root.focus({ preventScroll: true });
    },
    setStyle,
    format,
    insertTable,
    insertRule,
    insertSignatures,
    undo: () => travel(-1),
    redo: () => travel(1),
    hasSelection: () => !!caret(),
    destroy() { document.removeEventListener('selectionchange', onSelection); clearTimeout(typingTimer); },
  };
}
