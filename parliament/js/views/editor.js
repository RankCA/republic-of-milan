// /parliament/portal/new and /parliament/portal/edit/:id
// The act editor: a word processor page with a details sidebar.

import { api } from '../api.js';
import { crest, icon } from '../art.js';
import { draftFromPdfText } from '../markup.js';
import { setLeaveGuard, setTitle } from '../app.js';
import { getSeal } from '../session.js';
import { KINDS, KIND_ORDER, STATUSES, STATUS_ORDER, esc, fmtBytes, fmtDate, kindLabel, reference, refHtml, to, toast } from '../util.js';
import { createEditor, STYLES } from '../wp.js';
import { docSheet } from './act.js';
import { requireMember } from './portal-shell.js';

const FIELDS = ['kind', 'status', 'summary', 'sponsor', 'introduced_on', 'passed_on', 'effective_on', 'expires_on', 'votes_for', 'votes_against', 'votes_abstain'];

function friendly(e) {
  const msg = String(e.message || e);
  if (/title_check/.test(msg)) return 'The title must be between 3 and 200 characters.';
  if (/votes_.*check/.test(msg)) return 'Vote counts cannot be negative.';
  if (/body_check/.test(msg)) return 'The text is too long. Attach it as a PDF instead.';
  if (/summary_check/.test(msg)) return 'The summary is too long. Keep it to a short paragraph.';
  if (/invalid input syntax for type date/.test(msg)) return 'One of the dates is not valid.';
  if (/invalid input syntax for type integer/.test(msg)) return 'Vote counts must be whole numbers.';
  return msg;
}

const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const KEY = mac ? '⌘' : 'Ctrl+';

const SHORTCUT_HELP = `
  <h2>Writing an act</h2>
  <p>Type on the page as you would in a word processor. Pick a style from the toolbar, or start a line with one of these and press space.</p>
  <table class="wp-keys">
    <tr><td><code>#</code></td><td>Section. Sections number themselves: 1, 2, 3.</td></tr>
    <tr><td><code>##</code></td><td>Heading without a number, such as Annex A or Signatures</td></tr>
    <tr><td><code>1.1</code></td><td>Clause. Clauses number themselves within their section: 1.1, 1.2.</td></tr>
    <tr><td><code>-</code></td><td>Bullet point</td></tr>
    <tr><td><code>&gt;</code></td><td>Translation of the line above, set in italics</td></tr>
    <tr><td><code>---</code> then Enter</td><td>Divider</td></tr>
  </table>
  <p>Press Enter on an empty clause or bullet to go back to normal text. Backspace at the start of a styled line does the same.</p>
  <table class="wp-keys">
    <tr><td><kbd>${KEY}B</kbd> <kbd>${KEY}I</kbd></td><td>Bold, italic</td></tr>
    <tr><td><kbd>${KEY}Z</kbd> <kbd>${KEY}${mac ? '⇧' : 'Shift+'}Z</kbd></td><td>Undo, redo</td></tr>
    <tr><td><kbd>${KEY}S</kbd></td><td>Save</td></tr>
    <tr><td><kbd>${KEY}${mac ? '⌥' : 'Alt+'}1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>0</kbd></td><td>Section, heading, clause, normal text</td></tr>
    <tr><td><kbd>${KEY}${mac ? '⇧' : 'Shift+'}8</kbd></td><td>Bullet points</td></tr>
    <tr><td><kbd>Tab</kbd></td><td>Next cell in a table</td></tr>
  </table>
  <p>Everything is stored as Markdown. Open the Markdown tab to see or edit it directly.</p>`;

const draftKey = (id) => `milan.draft.${id || 'new'}`;
const readDraft = (id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || 'null'); } catch { return null; } };
const writeDraft = (id, data) => { try { localStorage.setItem(draftKey(id), JSON.stringify(data)); } catch { /* storage full or blocked */ } };
const dropDraft = (id) => { try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ } };

export async function render(main, ctx) {
  const m = await requireMember(main, ctx);
  if (!m || !ctx.isCurrent()) return;
  const seal = getSeal();
  const editing = ctx.params[0] && ctx.params[0] !== 'new' ? ctx.params[0] : null;

  let act;
  if (editing) {
    act = await api.portalAct(seal, editing);
    if (!ctx.isCurrent()) return;
  } else {
    const kind = KINDS[ctx.query.get('kind')] ? ctx.query.get('kind') : 'bill';
    act = { kind, status: 'tabled', title: '', subtitle: '', body: '', parties: [], sponsor: m.name, published: true, introduced_on: new Date().toISOString().slice(0, 10), events: [] };
  }
  setTitle(editing ? `Editing ${act.title}` : 'New act');
  let dirty = false;
  let saving = false;
  let mode = 'page';

  const v = (x) => esc(x ?? '');
  const styleOptions = Object.entries(STYLES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('');
  const tb = (name, label, title, extra = '') => `<button class="wp-btn" type="button" data-cmd="${name}" title="${title}" aria-label="${title}" ${extra}>${icon(label)}</button>`;
  const tbText = (name, label, text, title) => `<button class="wp-btn wp-btn-text" type="button" data-cmd="${name}" title="${title}" aria-label="${title}">${icon(label)}<span>${text}</span></button>`;

  main.innerHTML = `
  <div class="wp-app">
    <div class="wp-bar dark">
      <div class="wp-bar-inner">
        <a class="wp-back" href="${to('/portal')}" title="Back to your acts">${icon('arrow-left')}<span>Acts</span></a>
        ${crest(22, 'wp-bar-crest')}
        <div class="wp-name">
          <strong id="bar-title">${v(act.title) || 'Untitled act'}</strong>
          <span id="bar-ref"></span>
        </div>
        <span class="wp-state" id="save-state" aria-live="polite">${editing ? 'All changes saved' : 'Not yet entered in the Register'}</span>
        <button class="btn btn-line btn-sm" type="button" id="preview-btn">${icon('eye')}<span class="hide-sm">Preview</span></button>
        <button class="btn btn-red btn-sm" type="button" id="save">${icon('check')}<span>${editing ? 'Save' : 'Enter in Register'}</span></button>
      </div>
    </div>
    <div class="wp-toolbar" role="toolbar" aria-label="Formatting">
      <div class="wp-toolbar-inner">
        <label class="sr-only" for="wp-style">Paragraph style</label>
        <select class="wp-style" id="wp-style">${styleOptions}</select>
        <span class="wp-sep"></span>
        ${tb('bold', 'bold', `Bold (${KEY}B)`)}
        ${tb('italic', 'italic', `Italic (${KEY}I)`)}
        <span class="wp-sep"></span>
        ${tbText('section', 'heading', 'Section', 'Numbered section')}
        ${tbText('clause', 'list-ordered', 'Clause', 'Numbered clause')}
        ${tbText('bullet', 'list', 'Bullets', 'Bullet points')}
        ${tbText('tr', 'languages', 'Translation', 'Translation of the line above')}
        <span class="wp-sep"></span>
        ${tbText('table', 'table', 'Table', 'Insert a table')}
        ${tbText('signatures', 'signature', 'Signatures', 'Insert signature lines')}
        ${tb('rule', 'minus', 'Insert a divider')}
        <span class="wp-sep"></span>
        ${tb('undo', 'undo', `Undo (${KEY}Z)`)}
        ${tb('redo', 'redo', `Redo (${KEY}${mac ? '⇧' : 'Shift+'}Z)`)}
        <span class="wp-spacer"></span>
        <div class="wp-modes" role="tablist" aria-label="View">
          <button type="button" role="tab" data-mode="page" aria-selected="true">Page</button>
          <button type="button" role="tab" data-mode="md" aria-selected="false">Markdown</button>
        </div>
        ${tb('help', 'help', 'How to write an act')}
      </div>
    </div>

    <div class="wp-main">
      <div class="wp-canvas">
        <div id="draft-notice"></div>
        <article class="doc-sheet wp-page" id="page">
          <header class="doc-masthead">
            ${crest(40)}
            <div class="state">Republic of Milan</div>
            <div class="house">Parliament</div>
            <p class="kicker" id="page-ref"></p>
            <h1 class="wp-title" id="page-title" contenteditable="true" spellcheck="true" data-placeholder="Untitled act" aria-label="Title">${v(act.title)}</h1>
            <p class="doc-sub wp-sub" id="page-sub" contenteditable="true" spellcheck="true" data-placeholder="Add a subtitle (optional)" aria-label="Subtitle">${v(act.subtitle)}</p>
            <hr>
          </header>
          <div class="doc-body" id="wp" aria-label="Text of the act" data-placeholder="Start writing. Use the toolbar for sections, clauses and bullets, or paste the text of the act."></div>
        </article>
        <div class="wp-source" id="source" hidden>
          <label class="sr-only" for="md">Markdown</label>
          <textarea class="textarea code" id="md" spellcheck="false"></textarea>
          <p class="hint">This is the same act written in Markdown. Changes here show on the page when you switch back.</p>
        </div>
      </div>

      <aside class="wp-side" id="side">
        <section class="form-card">
          <h2>The act</h2>
          <div class="fields">
            <label class="field"><span>Type</span><select class="select" name="kind">${KIND_ORDER.map((k) => `<option value="${k}">${KINDS[k].label}</option>`).join('')}</select></label>
            <label class="field"><span>Status</span><select class="select" name="status">${STATUS_ORDER.map((s) => `<option value="${s}">${STATUSES[s].label}</option>`).join('')}</select></label>
            <label class="field full"><span>In brief <em>shown above the text</em></span><textarea class="textarea" name="summary" maxlength="1500" rows="3" placeholder="Two or three plain sentences for citizens">${v(act.summary)}</textarea></label>
            <label class="field full"><span>Other parties <em>for treaties</em></span><input class="input" name="parties" value="${v((act.parties || []).join(', '))}" placeholder="Republic of Xyon, Aegean Federation"></label>
            <label class="field full"><span>Sponsor</span><input class="input" name="sponsor" maxlength="120" value="${v(act.sponsor)}"></label>
          </div>
        </section>

        <section class="form-card">
          <h2>Original PDF</h2>
          <div id="pdf-slot"></div>
          <input type="file" id="file" accept="application/pdf,.pdf" hidden>
        </section>

        <details class="form-card wp-fold" ${act.passed_on || act.votes_for != null ? 'open' : ''}>
          <summary><h2>Dates and the vote</h2></summary>
          <div class="fields">
            <label class="field"><span>Introduced</span><input class="input" type="date" name="introduced_on" value="${v(act.introduced_on)}"></label>
            <label class="field"><span>Passed</span><input class="input" type="date" name="passed_on" value="${v(act.passed_on)}"></label>
            <label class="field"><span>In force from</span><input class="input" type="date" name="effective_on" value="${v(act.effective_on)}"></label>
            <label class="field"><span>Expires</span><input class="input" type="date" name="expires_on" value="${v(act.expires_on)}"></label>
            <label class="field"><span>Ayes</span><input class="input" type="number" min="0" step="1" name="votes_for" value="${v(act.votes_for)}"></label>
            <label class="field"><span>Noes</span><input class="input" type="number" min="0" step="1" name="votes_against" value="${v(act.votes_against)}"></label>
            <label class="field"><span>Abstained</span><input class="input" type="number" min="0" step="1" name="votes_abstain" value="${v(act.votes_abstain)}"></label>
          </div>
          <p class="hint" style="margin-top:10px">Leave the votes empty if there was no vote.</p>
        </details>

        <section class="form-card">
          <h2>Publication</h2>
          <label class="check"><input type="checkbox" name="published" ${act.published !== false ? 'checked' : ''}><span>Show in the public Register. Untick to keep it as a private draft for Members.</span></label>
        </section>

        ${editing ? `<details class="form-card wp-fold">
          <summary><h2>Passage</h2></summary>
          <p class="hint" style="margin-bottom:12px">Status changes are recorded on their own. Add readings, debates or signings here.</p>
          <ol class="events-edit" id="events"></ol>
          <div class="event-add">
            <input class="input" type="date" id="ev-date" aria-label="Date" value="${new Date().toISOString().slice(0, 10)}">
            <input class="input" id="ev-label" maxlength="120" placeholder="e.g. Second reading" aria-label="What happened">
            <button class="btn btn-xs btn-line" type="button" id="ev-add">${icon('plus')} Add</button>
          </div>
        </details>
        <details class="form-card wp-fold">
          <summary><h2>Delete</h2></summary>
          <p class="hint" style="margin-bottom:12px">Deleting removes the act and its history for good. Only the Keeper of the Seals or the member who entered it can do this. To keep a record, set the status to Withdrawn or Repealed instead.</p>
          <button class="btn btn-xs btn-danger" type="button" id="delete">${icon('trash')} Delete this act</button>
        </details>` : ''}
      </aside>
    </div>
  </div>`;

  const $ = (s) => main.querySelector(s);
  const side = $('#side');
  const field = (n) => side.querySelector(`[name="${n}"]`);
  field('kind').value = act.kind;
  field('status').value = act.status;
  const titleEl = $('#page-title');
  const subEl = $('#page-sub');
  const mdEl = $('#md');

  // The word processor ------------------------------------------------------------
  const styleSel = $('#wp-style');
  const btn = (cmd) => main.querySelector(`[data-cmd="${cmd}"]`);
  const editor = createEditor($('#wp'), {
    markdown: act.body || '',
    onChange: () => markDirty(),
    onState: (st) => {
      styleSel.value = STYLES[st.type] ? st.type : 'p';
      styleSel.disabled = st.type === 'table';
      btn('bold').setAttribute('aria-pressed', String(!!st.bold));
      btn('italic').setAttribute('aria-pressed', String(!!st.italic));
      for (const k of ['section', 'clause', 'bullet', 'tr']) btn(k).setAttribute('aria-pressed', String(st.type === k));
      btn('undo').disabled = !st.canUndo;
      btn('redo').disabled = !st.canRedo;
    },
  });

  const body = () => (mode === 'md' ? mdEl.value : editor.getMarkdown());
  const plain = (el) => el.textContent.replace(/\s+/g, ' ').trim();

  const collect = () => {
    const out = { ...act };
    for (const k of FIELDS) out[k] = field(k).value;
    out.title = plain(titleEl);
    out.subtitle = plain(subEl);
    out.parties = field('parties').value.split(',').map((x) => x.trim()).filter(Boolean);
    out.published = field('published').checked;
    out.body = body();
    return out;
  };

  function drawRef() {
    const kind = field('kind').value;
    const sameKind = editing && kind === act.kind && act.number;
    $('#page-ref').innerHTML = sameKind ? refHtml({ kind, number: act.number }) : `New ${esc(kindLabel(kind).toLowerCase())}`;
    $('#bar-ref').textContent = sameKind ? reference({ kind, number: act.number }) : `New ${kindLabel(kind).toLowerCase()}, numbered when entered`;
    $('#bar-title').textContent = plain(titleEl) || 'Untitled act';
  }
  drawRef();

  // Saving state and the local safety copy ----------------------------------------
  let draftTimer = null;
  function markDirty() {
    dirty = true;
    $('#save-state').textContent = 'Unsaved changes';
    $('#save-state').dataset.s = 'dirty';
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => writeDraft(editing, { at: new Date().toISOString(), data: collect() }), 800);
  }
  setLeaveGuard(() => (dirty ? 'You have unsaved changes to this act. Leave without saving?' : ''));

  const draft = readDraft(editing);
  if (draft && (!editing || draft.at > (act.updated_at || ''))) {
    const d = draft.data || {};
    const differs = ['title', 'subtitle', 'body', 'summary'].some((k) => (d[k] || '') !== (act[k] || ''));
    if (differs) {
      $('#draft-notice').innerHTML = `<div class="notice wp-notice">${icon('file')}<span>You have unsaved work on this act from ${fmtDate(draft.at.slice(0, 10))} at ${draft.at.slice(11, 16)} UTC, kept on this device.</span><button class="btn btn-xs btn-red" type="button" id="draft-restore">Restore it</button><button class="btn btn-xs btn-line" type="button" id="draft-drop">Discard</button></div>`;
      $('#draft-restore').onclick = () => {
        titleEl.textContent = d.title || '';
        subEl.textContent = d.subtitle || '';
        for (const k of FIELDS) if (d[k] != null) field(k).value = d[k];
        field('parties').value = (d.parties || []).join(', ');
        field('published').checked = d.published !== false;
        editor.setMarkdown(d.body || '');
        $('#draft-notice').innerHTML = '';
        drawRef();
        markDirty();
        toast('Your unsaved work is back. Save it to put it in the Register.');
      };
      $('#draft-drop').onclick = () => { dropDraft(editing); $('#draft-notice').innerHTML = ''; };
    } else dropDraft(editing);
  }

  // Title and subtitle: one line of plain text each ----------------------------------
  for (const el of [titleEl, subEl]) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (el === titleEl) subEl.focus(); else editor.focus(); }
    });
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' '));
    });
    el.addEventListener('input', () => {
      if (el.querySelector('*:not(br)')) el.textContent = el.textContent;
      if (!el.textContent.trim()) el.innerHTML = '';
      drawRef();
      markDirty();
    });
  }

  side.addEventListener('input', () => { drawRef(); markDirty(); });
  side.addEventListener('change', () => { drawRef(); markDirty(); });

  // Toolbar -------------------------------------------------------------------------
  const toolbar = main.querySelector('.wp-toolbar');
  toolbar.addEventListener('mousedown', (e) => { if (e.target.closest('.wp-btn')) e.preventDefault(); });
  styleSel.addEventListener('change', () => editor.setStyle(styleSel.value));
  toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b) return;
    if (mode === 'md' && b.dataset.cmd !== 'help') { setMode('page'); }
    const cmd = b.dataset.cmd;
    if (cmd === 'bold' || cmd === 'italic') editor.format(cmd);
    else if (['section', 'clause', 'bullet', 'tr'].includes(cmd)) editor.setStyle(cmd);
    else if (cmd === 'table') editor.insertTable();
    else if (cmd === 'signatures') editor.insertSignatures();
    else if (cmd === 'rule') editor.insertRule();
    else if (cmd === 'undo') editor.undo();
    else if (cmd === 'redo') editor.redo();
    else if (cmd === 'help') openHelp();
  });

  function setMode(next) {
    if (next === mode) return;
    if (next === 'md') {
      mdEl.value = editor.getMarkdown();
      $('#page').hidden = true;
      $('#source').hidden = false;
      mdEl.focus();
    } else {
      editor.setMarkdown(mdEl.value);
      $('#source').hidden = true;
      $('#page').hidden = false;
    }
    mode = next;
    main.querySelectorAll('.wp-modes [data-mode]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
    toolbar.classList.toggle('md-mode', mode === 'md');
  }
  main.querySelectorAll('.wp-modes [data-mode]').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
  mdEl.addEventListener('input', markDirty);

  function modal(html, cls = '') {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true"><button class="modal-x" type="button" aria-label="Close">${icon('x')}</button>${html}</div>`;
    const close = () => { back.remove(); removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('.modal-x')) close(); });
    addEventListener('keydown', onKey);
    document.body.append(back);
    back.querySelector('.modal-x').focus();
  }
  const openHelp = () => modal(SHORTCUT_HELP, 'wp-help');
  $('#preview-btn').addEventListener('click', () => {
    const a = collect();
    if (!a.number || a.kind !== act.kind) a.number = null;
    modal(`<p class="kicker">Preview</p><p class="hint" style="margin-bottom:18px">This is how citizens will see the act once it is saved.</p>${a.summary ? `<section class="brief"><p class="kicker plain">In brief</p><p>${esc(a.summary)}</p></section>` : ''}${docSheet(a, a.body)}`, 'wp-preview');
  });

  // Original PDF ------------------------------------------------------------------------
  const slot = $('#pdf-slot');
  const fileInput = $('#file');
  let busy = false;
  const drawPdf = (state = {}) => {
    if (state.uploading) {
      slot.innerHTML = `<div class="file-card"><span class="doc-ico">PDF</span><div><strong>${esc(state.name)}</strong><small>Reading and uploading</small><div class="progress"><i></i></div></div></div>`;
      return;
    }
    if (act.pdf_path) {
      slot.innerHTML = `<div class="file-card"><span class="doc-ico">PDF</span><div><strong>${esc(act.pdf_name || 'Document.pdf')}</strong><small>${[act.pdf_pages ? `${act.pdf_pages} ${act.pdf_pages === 1 ? 'page' : 'pages'}` : '', fmtBytes(act.pdf_size)].filter(Boolean).join(', ')}</small></div><a class="btn btn-xs btn-line" href="${api.publicUrl(act.pdf_path)}" target="_blank" rel="noopener">Open</a></div>
        <div class="file-actions">
          ${act._pdfText ? '<button class="btn btn-xs btn-green" type="button" id="use-text">Put its text on the page</button>' : ''}
          <button class="btn btn-xs btn-line" type="button" id="replace">Replace</button>
          <button class="btn btn-xs btn-danger" type="button" id="remove">Remove</button>
        </div>`;
      slot.querySelector('#replace').onclick = () => fileInput.click();
      slot.querySelector('#remove').onclick = () => {
        Object.assign(act, { pdf_path: null, pdf_name: null, pdf_size: null, pdf_pages: null, pdf_text: null, _pdfText: null });
        markDirty();
        drawPdf();
      };
      slot.querySelector('#use-text')?.addEventListener('click', () => {
        if (editor.getMarkdown().trim() && !confirm('Replace the text on the page with the text from the PDF?')) return;
        setMode('page');
        editor.setMarkdown(draftFromPdfText(act._pdfText));
        markDirty();
        toast('The PDF text is on the page. Check the sections and clauses, then save.');
      });
    } else {
      slot.innerHTML = `<div class="dropzone" id="drop" role="button" tabindex="0">${icon('upload')}<strong>Attach the PDF</strong><span>Drop it here or click to choose. Its text can go straight onto the page.</span></div>`;
      const drop = slot.querySelector('#drop');
      drop.onclick = () => fileInput.click();
      drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } };
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]); };
    }
  };
  async function takeFile(file) {
    if (busy) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Only PDF files can be attached.', 'error'); return; }
    if (file.size > 25 * 1024 * 1024) { toast('That PDF is larger than 25 MB.', 'error'); return; }
    busy = true;
    drawPdf({ uploading: true, name: file.name });
    try {
      const { readPdf } = await import('../pdf.js');
      let info = { pages: null, text: '' };
      try { info = await readPdf(file); } catch { toast('The PDF was attached, but its text could not be read.', 'error'); }
      const path = await api.uploadPdf(seal, file);
      Object.assign(act, { pdf_path: path, pdf_name: file.name, pdf_size: file.size, pdf_pages: info.pages, pdf_text: info.text.slice(0, 390000) || null, _pdfText: info.text });
      if (!plain(titleEl)) titleEl.textContent = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      if (info.text && !editor.getMarkdown().trim()) {
        setMode('page');
        editor.setMarkdown(draftFromPdfText(info.text));
        toast('PDF attached and its text put on the page. Check the sections and clauses, then save.');
      } else toast('PDF attached.');
      drawRef();
      markDirty();
    } catch (e) {
      toast(friendly(e), 'error');
    } finally {
      busy = false;
      fileInput.value = '';
      drawPdf();
    }
  }
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) takeFile(fileInput.files[0]); });
  drawPdf();

  // Passage ---------------------------------------------------------------------------
  const drawEvents = () => {
    const ol = $('#events');
    if (!ol) return;
    ol.innerHTML = (act.events || []).map((e) => `<li><time>${fmtDate(e.happened_on, true)}</time><span>${esc(e.label)}</span><button type="button" data-ev="${e.id}" aria-label="Remove ${esc(e.label)}">${icon('x')}</button></li>`).join('') || '<li class="muted">Nothing recorded yet.</li>';
  };
  drawEvents();
  $('#events')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ev]');
    if (!b || !confirm('Remove this entry from the passage of the act?')) return;
    try { act.events = (await api.deleteEvent(seal, Number(b.dataset.ev))).events; drawEvents(); } catch (err) { toast(friendly(err), 'error'); }
  });
  $('#ev-add')?.addEventListener('click', async () => {
    const label = $('#ev-label').value.trim();
    if (!label) { $('#ev-label').focus(); return; }
    try {
      act.events = (await api.addEvent(seal, act.id, $('#ev-date').value, label, null)).events;
      $('#ev-label').value = '';
      drawEvents();
      toast('Added to the passage of the act.');
    } catch (err) { toast(friendly(err), 'error'); }
  });
  $('#delete')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${act.title} from the Register for good? This cannot be undone.`)) return;
    try {
      await api.deleteAct(seal, act.id);
      dirty = false;
      dropDraft(editing);
      setLeaveGuard(null);
      toast('The act has been deleted.');
      ctx.navigate(to('/portal'), { replace: true });
    } catch (err) { toast(friendly(err), 'error'); }
  });

  // Save -------------------------------------------------------------------------------
  const saveBtn = $('#save');
  async function save() {
    if (saving) return;
    const data = collect();
    if (!data.title || data.title.length < 3) {
      toast('Give the act a title of at least 3 characters, at the top of the page.', 'error');
      setMode('page');
      titleEl.focus();
      return;
    }
    for (const k of ['votes_for', 'votes_against', 'votes_abstain']) {
      if (data[k] !== '' && data[k] != null && !(Number.isInteger(Number(data[k])) && Number(data[k]) >= 0)) {
        toast('Vote counts must be whole numbers, zero or more.', 'error');
        side.querySelector('.wp-fold').open = true;
        field(k).focus();
        return;
      }
    }
    const payload = { ...data };
    delete payload.events;
    delete payload._pdfText;
    if (act.pdf_text === undefined) delete payload.pdf_text;
    saving = true;
    saveBtn.disabled = true;
    $('#save-state').textContent = 'Saving';
    $('#save-state').dataset.s = 'saving';
    try {
      const r = await api.saveAct(seal, payload);
      dirty = false;
      clearTimeout(draftTimer);
      dropDraft(editing);
      if (!editing) {
        toast(`Entered in the Register as ${reference(r)}.`);
        setLeaveGuard(null);
        ctx.navigate(to(`/portal/edit/${r.id}`), { replace: true });
        return;
      }
      Object.assign(act, r);
      drawEvents();
      drawRef();
      const now = new Date();
      $('#save-state').textContent = `Saved at ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      $('#save-state').dataset.s = 'saved';
      setTitle(`Editing ${r.title}`);
    } catch (e) {
      $('#save-state').textContent = 'Not saved';
      $('#save-state').dataset.s = 'error';
      toast(friendly(e), 'error');
    } finally {
      saving = false;
      saveBtn.disabled = false;
    }
  }
  saveBtn.addEventListener('click', save);
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  };
  addEventListener('keydown', onKey);

  if (!editing && !plain(titleEl)) titleEl.focus();
  else editor.focus();

  return () => {
    setLeaveGuard(null);
    removeEventListener('keydown', onKey);
    clearTimeout(draftTimer);
    editor.destroy();
  };
}

