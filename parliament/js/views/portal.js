// /parliament/portal: the member's list of acts.

import { api } from '../api.js';
import { icon } from '../art.js';
import { emptyState, statusPill } from '../components.js';
import { setTitle } from '../app.js';
import { getSeal, signOut } from '../session.js';
import { esc, fmtDate, reference, to } from '../util.js';
import { hon, portalHead, requireMember } from './portal-shell.js';

export async function render(main, ctx) {
  const m = await requireMember(main, ctx);
  if (!m || !ctx.isCurrent()) return;
  setTitle("Members' Portal");
  main.innerHTML = `${portalHead(m, 'acts', `Welcome, ${hon(m)}`, `
    <a class="btn btn-red" href="${to('/portal/new')}">${icon('plus')} Table a new act</a>
    <button class="btn btn-line" type="button" id="signout">${icon('log-out')} Sign out</button>`)}
  <section class="paper"><div class="container portal-body" id="acts"><p class="hint">Consulting the archive</p></div></section>`;
  main.querySelector('#signout').addEventListener('click', () => {
    signOut();
    ctx.navigate(to('/portal'), { replace: true });
  });

  const acts = await api.portalActs(getSeal());
  if (!ctx.isCurrent()) return;
  const drafts = acts.filter((a) => !a.published).length;
  main.querySelector('#acts').innerHTML = acts.length ? `
    <p class="result-meta" style="margin-top:0"><span>${acts.length} ${acts.length === 1 ? 'act' : 'acts'} in the Register${drafts ? `, ${drafts} not yet published` : ''}</span></p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Act</th><th>Status</th><th>Last change</th><th class="t-acts"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${acts.map((a) => `
        <tr>
          <td class="t-title"><a href="${to(`/portal/edit/${a.id}`)}">${esc(a.title)}</a>${a.published ? '' : '<span class="tag">Not published</span>'}<small>${esc(reference(a))}${a.has_pdf ? ', PDF attached' : ''}${a.has_text ? ', text entered' : ''}</small></td>
          <td>${statusPill(a.status)}</td>
          <td>${fmtDate(a.updated_at, true)}</td>
          <td class="t-acts"><a class="btn btn-xs btn-line" href="${to(`/portal/edit/${a.id}`)}">${icon('pencil')} Edit</a>${a.published ? `<a class="btn btn-xs btn-line" href="${to(`/acts/${encodeURIComponent(a.slug)}`)}">${icon('eye')} View</a>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : emptyState('The Register is empty', 'Table the first act of the Republic.', `<a class="btn btn-red" href="${to('/portal/new')}">${icon('plus')} Table a new act</a>`);
}
