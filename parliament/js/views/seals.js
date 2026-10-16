import { api } from '../api.js';
import { crest, icon } from '../art.js';
import { setTitle } from '../app.js';
import { getSeal } from '../session.js';
import { copyText, esc, fmtDate, toast, to } from '../util.js';
import { portalHead, requireMember } from './portal-shell.js';

export function sealModal(member, seal, { self = false } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal certificate" role="dialog" aria-modal="true" aria-labelledby="seal-title">
    ${crest(44)}
    <h2 id="seal-title">${self ? 'Your new seal' : `The seal of ${esc(member.name)}`}</h2>
    <p>${self ? 'Your old seal no longer works. Keep this one somewhere safe.' : 'Send it to them privately, for example in a Discord direct message. It is shown only once.'}</p>
    <div class="seal-code">${esc(seal)}</div>
    <p class="hint">Anyone holding this seal can act as ${self ? 'you' : 'this member'} in the portal.${self ? '' : ' If it leaks, issue a new one and the old one stops working.'}</p>
    <div class="btns">
      <button class="btn btn-line" type="button" data-copy>${icon('link')} Copy seal</button>
      <button class="btn btn-red" type="button" data-close>Done</button>
    </div>
  </div>`;
  document.body.append(back);
  back.querySelector('[data-copy]').addEventListener('click', async () => {
    toast((await copyText(seal)) ? 'Seal copied.' : 'Could not copy. Select the seal and copy it by hand.');
  });
  back.querySelector('[data-close]').addEventListener('click', () => back.remove());
  back.querySelector('[data-close]').focus();
}

export async function render(main, ctx) {
  const m = await requireMember(main, ctx);
  if (!m || !ctx.isCurrent()) return;
  setTitle('Members and seals');
  const seal = getSeal();
  if (m.role !== 'keeper') {
    main.innerHTML = `${portalHead(m, 'seals', 'Members and Seals')}<div class="container portal-body"><p class="notice">Only the Keeper of the Seals can swear in members and issue seals.</p></div>`;
    return;
  }

  main.innerHTML = `${portalHead(m, 'seals', 'Members and Seals')}
  <div class="container portal-body">
    <section class="form-card">
      <h2>Swear in a member</h2>
      <form id="add" class="fields" autocomplete="off">
        <label class="field"><span>Name</span><input class="input" name="name" required maxlength="80" placeholder="Their in-game name"></label>
        <label class="field"><span>Title</span><input class="input" name="title" maxlength="80" placeholder="Member of Parliament"></label>
        <label class="field"><span>Party <em>optional</em></span><input class="input" name="party" maxlength="80"></label>
        <label class="field"><span>Role</span><select class="select" name="role"><option value="mp">Member of Parliament</option><option value="keeper">Keeper of the Seals (can manage members)</option></select></label>
        <div class="full"><button class="btn btn-red" type="submit">${icon('key')} Swear in and issue a seal</button></div>
      </form>
    </section>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Member</th><th>Role</th><th>Last used seal</th><th class="t-acts"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody id="rows"><tr><td colspan="4" class="muted">Calling the roll</td></tr></tbody>
    </table></div>
  </div>`;

  let list = [];
  const draw = () => {
    main.querySelector('#rows').innerHTML = list.map((x) => `
      <tr${x.active ? '' : ' style="opacity:.55"'}>
        <td class="t-title"><strong>${esc(x.name)}</strong>${x.id === m.id ? ' <span class="tag">You</span>' : ''}${x.active ? '' : ' <span class="tag">Seal revoked</span>'}<small>${esc(x.title || '')}${x.party ? `, ${esc(x.party)}` : ''}</small></td>
        <td>${x.role === 'keeper' ? 'Keeper of the Seals' : 'Member'}</td>
        <td>${x.last_used ? fmtDate(x.last_used, true) : '<span class="muted">Never</span>'}</td>
        <td class="t-acts">${x.id === m.id ? `<a class="btn btn-xs btn-line" href="${to('/portal/profile')}">Profile</a>` : `
          <button class="btn btn-xs btn-line" type="button" data-act="seal" data-id="${x.id}">New seal</button>
          <button class="btn btn-xs btn-line" type="button" data-act="role" data-id="${x.id}">${x.role === 'keeper' ? 'Make member' : 'Make keeper'}</button>
          <button class="btn btn-xs ${x.active ? 'btn-danger' : 'btn-line'}" type="button" data-act="active" data-id="${x.id}">${x.active ? 'Revoke' : 'Restore'}</button>`}
        </td>
      </tr>`).join('');
  };
  const load = async () => { list = await api.members(seal); if (ctx.isCurrent()) draw(); };

  main.querySelector('#add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.name.value.trim()) { f.name.focus(); return; }
    const btn = f.querySelector('button');
    btn.disabled = true;
    try {
      const r = await api.addMember(seal, { name: f.name.value, title: f.title.value, party: f.party.value, role: f.role.value });
      f.reset();
      sealModal(r.member, r.seal);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  main.querySelector('#rows').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const x = list.find((y) => y.id === b.dataset.id);
    try {
      if (b.dataset.act === 'seal') {
        if (!confirm(`Issue a new seal for ${x.name}? Their current seal stops working at once.`)) return;
        const s = await api.newSeal(seal, x.id);
        sealModal(x, s);
      } else if (b.dataset.act === 'role') {
        const role = x.role === 'keeper' ? 'mp' : 'keeper';
        if (role === 'keeper' && !confirm(`Make ${x.name} a Keeper of the Seals? They will be able to swear in members and revoke seals.`)) return;
        await api.updateMember(seal, { id: x.id, role });
        toast(role === 'keeper' ? `${x.name} is now a Keeper of the Seals.` : `${x.name} is now a member.`);
      } else if (b.dataset.act === 'active') {
        if (x.active && !confirm(`Revoke the seal of ${x.name}? They will no longer be able to enter the portal or appear in the Chamber.`)) return;
        await api.updateMember(seal, { id: x.id, active: !x.active });
        toast(x.active ? `${x.name}'s seal has been revoked.` : `${x.name} has been restored.`);
      }
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  await load();
}
