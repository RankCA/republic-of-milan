import { api } from '../api.js';
import { icon } from '../art.js';
import { draftFromPdfText } from '../markup.js';
import { setLeaveGuard, setTitle } from '../app.js';
import { getSeal } from '../session.js';
import { KINDS, KIND_ORDER, STATUSES, STATUS_ORDER, debounce, esc, fmtBytes, fmtDate, reference, toast, to } from '../util.js';
import { docSheet } from './act.js';
import { portalHead, requireMember } from './portal-shell.js';

const FIELDS = ['kind', 'status', 'title', 'subtitle', 'summary', 'sponsor', 'introduced_on', 'passed_on', 'effective_on', 'expires_on', 'votes_for', 'votes_against', 'votes_abstain', 'body'];

function friendly(e) {
  const msg = String(e.message || e);
  if (/title_check/.test(msg)) return 'The title must be between 3 and 200 characters.';
  if (/kind_check|kind/.test(msg) && /null/.test(msg)) return 'Choose what type of act this is.';
  if (/votes_.*check/.test(msg)) return 'Vote counts cannot be negative.';
  if (/body_check/.test(msg)) return 'The official text is too long. Attach it as a PDF instead.';
  if (/summary_check/.test(msg)) return 'The summary is too long. Keep it to a short paragraph.';
  if (/invalid input syntax for type date/.test(msg)) return 'One of the dates is not valid.';
  if (/invalid input syntax for type integer/.test(msg)) return 'Vote counts must be whole numbers.';
  return msg;
}

const HELP = `<details class="help"><summary>How to format the text</summary>
  <table>
    <tr><td><code># 1. Trade</code></td><td>Section heading</td></tr>
    <tr><td><code>## Annex A: Spheres</code></td><td>Annex or sub-heading</td></tr>
    <tr><td><code>1.1 Both states shall</code></td><td>Numbered clause. Article 3 also works.</td></tr>
    <tr><td><code>- Prices are negotiated</code></td><td>Bullet point</td></tr>
    <tr><td><code>&gt; Fiyatlar müzakere edilir</code></td><td>Translation of the line above</td></tr>
    <tr><td><code>| State | Sphere |</code></td><td>Table row. The first row is the header.</td></tr>
    <tr><td><code>President ______</code></td><td>Signature line</td></tr>
    <tr><td><code>**bold**  *italic*</code></td><td>Emphasis</td></tr>
  </table>
  <p class="hint" style="margin-top:8px">Lines without a marker join the line above, so text pasted from a PDF flows into paragraphs. Leave a blank line to start a new paragraph. Mentions of Section 4.2 or Annex A become links.</p>
</details>`;

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
    act = { kind: ctx.query.get('kind') && KINDS[ctx.query.get('kind')] ? ctx.query.get('kind') : 'bill', status: 'tabled', title: '', parties: [], sponsor: m.name, published: true, introduced_on: new Date().toISOString().slice(0, 10), events: [] };
  }
  let dirty = false;
  setTitle(editing ? `Edit ${act.title}` : 'Table a new act');

  const v = (x) => esc(x ?? '');
  main.innerHTML = `${portalHead(m, editing ? 'acts' : 'new', editing ? `Editing ${esc(reference(act))}` : 'Table a New Act', editing && act.published ? `<a class="btn btn-line" href="${to(`/acts/${encodeURIComponent(act.slug)}`)}">View public page ${icon('arrow-right')}</a>` : '')}
  <form class="container portal-body" id="form" novalidate>
    <div class="editor">
      <div>
        <section class="form-card">
          <h2>The act</h2>
          <div class="fields">
            <label class="field"><span>Type</span><select class="select" name="kind">${KIND_ORDER.map((k) => `<option value="${k}">${KINDS[k].label}</option>`).join('')}</select></label>
            <label class="field"><span>Status</span><select class="select" name="status">${STATUS_ORDER.map((s) => `<option value="${s}">${STATUSES[s].label}</option>`).join('')}</select></label>
            <label class="field full"><span>Title</span><input class="input" name="title" required minlength="3" maxlength="200" value="${v(act.title)}" placeholder="e.g. Milan and Xyon Agreement"></label>
            <label class="field full"><span>Subtitle <em>optional, shown under the title</em></span><input class="input" name="subtitle" maxlength="300" value="${v(act.subtitle)}" placeholder="e.g. Revision 4, a counterproposal by the Republic of Milan"></label>
            <label class="field full"><span>In brief <em>two or three plain sentences for citizens</em></span><textarea class="textarea" name="summary" maxlength="1500" rows="3">${v(act.summary)}</textarea></label>
            <label class="field full"><span>Other parties <em>for treaties, separated by commas</em></span><input class="input" name="parties" value="${v((act.parties || []).join(', '))}" placeholder="e.g. Republic of Xyon, Aegean Federation"></label>
            <label class="field full"><span>Sponsor <em>the member or office that brought it</em></span><input class="input" name="sponsor" maxlength="120" value="${v(act.sponsor)}"></label>
          </div>
        </section>

        <section class="form-card">
          <h2>Dates and the division</h2>
          <div class="fields">
            <label class="field"><span>Introduced</span><input class="input" type="date" name="introduced_on" value="${v(act.introduced_on)}"></label>
            <label class="field"><span>Passed</span><input class="input" type="date" name="passed_on" value="${v(act.passed_on)}"></label>
            <label class="field"><span>In force from</span><input class="input" type="date" name="effective_on" value="${v(act.effective_on)}"></label>
            <label class="field"><span>Expires</span><input class="input" type="date" name="expires_on" value="${v(act.expires_on)}"></label>
            <label class="field"><span>Ayes</span><input class="input" type="number" min="0" step="1" name="votes_for" value="${v(act.votes_for)}"></label>
            <label class="field"><span>Noes</span><input class="input" type="number" min="0" step="1" name="votes_against" value="${v(act.votes_against)}"></label>
            <label class="field"><span>Abstentions</span><input class="input" type="number" min="0" step="1" name="votes_abstain" value="${v(act.votes_abstain)}"></label>
          </div>
          <p class="hint" style="margin-top:12px">Leave the votes empty if no division was held. With votes entered, the public page draws the division as a chamber of seats.</p>
        </section>

        <section class="form-card">
          <h2>Original document</h2>
          <div id="pdf-slot"></div>
          <input type="file" id="file" accept="application/pdf,.pdf" hidden>
        </section>

        <section class="form-card">
          <h2>Official text</h2>
          <p class="hint" style="margin-bottom:10px">Citizens read this as a typeset document. You can skip it if a PDF is attached, but the text makes the act searchable and easy to read on a phone.</p>
          <textarea class="textarea code" name="body" spellcheck="true" placeholder="# 1. Trade&#10;1.1 Both states shall keep a trade agreement in force.">${v(act.body)}</textarea>
          ${HELP}
        </section>

        <section class="form-card">
          <h2>Publication</h2>
          <label class="check"><input type="checkbox" name="published" ${act.published !== false ? 'checked' : ''}><span>Publish in the Register for all citizens. Untick to keep this act as a private draft that only Members can see.</span></label>
        </section>

        ${editing ? `<section class="form-card">
          <h2>Passage</h2>
          <p class="hint" style="margin-bottom:12px">Status changes are recorded here on their own. Add readings, debates or signings by hand.</p>
          <ol class="events-edit" id="events"></ol>
          <div class="event-add">
            <input class="input" type="date" id="ev-date" aria-label="Date" value="${new Date().toISOString().slice(0, 10)}">
            <input class="input" id="ev-label" maxlength="120" placeholder="e.g. Second reading" aria-label="What happened">
            <button class="btn btn-xs btn-line" type="button" id="ev-add">${icon('plus')} Add</button>
          </div>
        </section>
        <section class="form-card">
          <h2>Remove</h2>
          <p class="hint" style="margin-bottom:12px">Deleting removes the act and its history from the Register for good. Only the Keeper of the Seals or the member who entered it can do this. To keep a record, set the status to Withdrawn or Repealed instead.</p>
          <button class="btn btn-xs btn-danger" type="button" id="delete">Delete this act</button>
        </section>` : ''}
      </div>
      <div class="preview-col">
        <div class="preview-label"><span>Preview</span><span>As citizens will see it</span></div>
        <div id="preview"></div>
      </div>
    </div>
  </form>
  <div class="save-bar dark"><div class="container">
    <span class="state" id="save-state">${editing ? 'No changes yet' : 'Not yet saved'}</span>
    <div class="btns">
      <a class="btn btn-line btn-sm" href="${to('/portal')}">Cancel</a>
      <button class="btn btn-red" type="button" id="save">${editing ? 'Save changes' : 'Enter in the Register'}</button>
    </div>
  </div></div>`;

  const form = main.querySelector('#form');
  form.kind.value = act.kind;
  form.status.value = act.status;

  const collect = () => {
    const f = form.elements;
    const out = { ...act };
    for (const k of FIELDS) if (f[k]) out[k] = f[k].value;
    out.parties = f.parties.value.split(',').map((s) => s.trim()).filter(Boolean);
    out.published = f.published.checked;
    return out;
  };

  const preview = main.querySelector('#preview');
  const drawPreview = () => { preview.innerHTML = docSheet(collect(), form.body.value); };
  const later = debounce(drawPreview, 150);
  drawPreview();

  const markDirty = () => {
    dirty = true;
    main.querySelector('#save-state').textContent = 'Unsaved changes';
  };
  form.addEventListener('input', () => { markDirty(); later(); });
  form.addEventListener('change', () => { markDirty(); later(); });
  setLeaveGuard(() => (dirty ? 'You have unsaved changes to this act. Leave without saving?' : ''));

  // Original document --------------------------------------------------------
  const slot = main.querySelector('#pdf-slot');
  const fileInput = main.querySelector('#file');
  let busy = false;
  const drawPdf = (state = {}) => {
    if (state.uploading) {
      slot.innerHTML = `<div class="file-card"><span class="doc-ico">PDF</span><div><strong>${esc(state.name)}</strong><small>Reading and uploading</small><div class="progress"><i></i></div></div></div>`;
      return;
    }
    if (act.pdf_path) {
      slot.innerHTML = `<div class="file-card"><span class="doc-ico">PDF</span><div><strong>${esc(act.pdf_name || 'Document.pdf')}</strong><small>${[act.pdf_pages ? `${act.pdf_pages} ${act.pdf_pages === 1 ? 'page' : 'pages'}` : '', fmtBytes(act.pdf_size)].filter(Boolean).join(', ')}</small></div><a class="btn btn-xs btn-line" href="${api.publicUrl(act.pdf_path)}" target="_blank" rel="noopener">Open</a></div>
        <div class="file-actions">
          ${act._pdfText ? `<button class="btn btn-xs btn-green" type="button" id="use-text">Use the PDF text as the official text</button>` : ''}
          <button class="btn btn-xs btn-line" type="button" id="replace">Replace PDF</button>
          <button class="btn btn-xs btn-danger" type="button" id="remove">Remove PDF</button>
        </div>`;
      slot.querySelector('#replace').onclick = () => fileInput.click();
      slot.querySelector('#remove').onclick = () => {
        Object.assign(act, { pdf_path: null, pdf_name: null, pdf_size: null, pdf_pages: null, pdf_text: null, _pdfText: null });
        markDirty();
        drawPdf();
      };
      slot.querySelector('#use-text')?.addEventListener('click', () => {
        if (form.body.value.trim() && !confirm('Replace the official text with the text from the PDF?')) return;
        form.body.value = draftFromPdfText(act._pdfText);
        markDirty();
        drawPreview();
        form.body.focus();
        toast('Text copied from the PDF. Check the headings and clauses in the preview.');
      });
    } else {
      slot.innerHTML = `<div class="dropzone" id="drop" role="button" tabindex="0">${icon('upload')}<strong>Attach the PDF</strong><span>Drop the file here or click to choose. Up to 25 MB.</span></div>`;
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
      if (!form.title.value.trim()) {
        form.title.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      }
      markDirty();
      later();
      if (info.text && !form.body.value.trim()) {
        form.body.value = draftFromPdfText(info.text);
        drawPreview();
        toast('PDF attached. Its text has been set out as the official text for you to check.');
      } else {
        toast('PDF attached.');
      }
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

  // Passage --------------------------------------------------------------------
  const drawEvents = () => {
    const ol = main.querySelector('#events');
    if (!ol) return;
    ol.innerHTML = (act.events || []).map((e) => `<li><time>${fmtDate(e.happened_on, true)}</time><span>${esc(e.label)}${e.member_name ? ` <small class="muted">by ${esc(e.member_name)}</small>` : ''}</span><button type="button" data-ev="${e.id}" aria-label="Remove ${esc(e.label)}">${icon('x')}</button></li>`).join('') || '<li class="muted">Nothing recorded yet.</li>';
  };
  drawEvents();
  main.querySelector('#events')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ev]');
    if (!b || !confirm('Remove this entry from the passage of the act?')) return;
    try {
      const r = await api.deleteEvent(seal, Number(b.dataset.ev));
      act.events = r.events;
      drawEvents();
    } catch (err) { toast(friendly(err), 'error'); }
  });
  main.querySelector('#ev-add')?.addEventListener('click', async () => {
    const label = main.querySelector('#ev-label').value.trim();
    if (!label) { main.querySelector('#ev-label').focus(); return; }
    try {
      const r = await api.addEvent(seal, act.id, main.querySelector('#ev-date').value, label, null);
      act.events = r.events;
      main.querySelector('#ev-label').value = '';
      drawEvents();
      toast('Added to the passage of the act.');
    } catch (err) { toast(friendly(err), 'error'); }
  });

  main.querySelector('#delete')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${act.title} from the Register for good? This cannot be undone.`)) return;
    try {
      await api.deleteAct(seal, act.id);
      dirty = false;
      setLeaveGuard(null);
      toast('The act has been deleted.');
      ctx.navigate(to('/portal'), { replace: true });
    } catch (err) { toast(friendly(err), 'error'); }
  });

  // Save ---------------------------------------------------------------------
  const saveBtn = main.querySelector('#save');
  saveBtn.addEventListener('click', async () => {
    const data = collect();
    if (!data.title || data.title.trim().length < 3) {
      toast('Give the act a title of at least 3 characters.', 'error');
      form.title.focus();
      return;
    }
    for (const k of ['votes_for', 'votes_against', 'votes_abstain']) {
      if (data[k] !== '' && data[k] != null && !(Number.isInteger(Number(data[k])) && Number(data[k]) >= 0)) {
        toast('Vote counts must be whole numbers, zero or more.', 'error');
        form[k].focus();
        return;
      }
    }
    const payload = { ...data };
    delete payload.events;
    delete payload._pdfText;
    if (!('pdf_text' in act) || act.pdf_text === undefined) delete payload.pdf_text;
    saveBtn.disabled = true;
    main.querySelector('#save-state').textContent = 'Sealing';
    try {
      const r = await api.saveAct(seal, payload);
      dirty = false;
      toast(editing ? 'Changes saved to the Register.' : `Entered in the Register as ${reference(r)}.`);
      if (!editing) {
        setLeaveGuard(null);
        ctx.navigate(to(`/portal/edit/${r.id}`), { replace: true });
        return;
      }
      Object.assign(act, r);
      drawEvents();
      main.querySelector('#save-state').textContent = `Saved as ${reference(r)}`;
      main.querySelector('.portal-head h1').textContent = `Editing ${reference(r)}`;
    } catch (e) {
      main.querySelector('#save-state').textContent = 'Not saved';
      toast(friendly(e), 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  if (!editing) form.title.focus();
  return () => setLeaveGuard(null);
}
