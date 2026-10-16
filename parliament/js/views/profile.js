import { api } from '../api.js';
import { icon } from '../art.js';
import { setTitle } from '../app.js';
import { getSeal, replaceSeal, signOut, updateMember } from '../session.js';
import { esc, toast, to } from '../util.js';
import { portalHead, requireMember } from './portal-shell.js';
import { sealModal } from './seals.js';

export async function render(main, ctx) {
  const m = await requireMember(main, ctx);
  if (!m || !ctx.isCurrent()) return;
  setTitle('My profile');
  const seal = getSeal();
  main.innerHTML = `${portalHead(m, 'profile', 'My Profile')}
  <div class="container portal-body" style="max-width:820px">
    <section class="form-card">
      <h2>How you appear in the Chamber</h2>
      <form id="profile" class="fields">
        <label class="field"><span>Name</span><input class="input" name="name" required maxlength="80" value="${esc(m.name)}"></label>
        <label class="field"><span>Title</span><input class="input" name="title" maxlength="80" value="${esc(m.title || '')}" placeholder="Member of Parliament"></label>
        <label class="field full"><span>Party <em>optional</em></span><input class="input" name="party" maxlength="80" value="${esc(m.party || '')}"></label>
        <label class="field full"><span>A line about you <em>optional</em></span><textarea class="textarea" name="bio" maxlength="1200" rows="3">${esc(m.bio || '')}</textarea></label>
        <div class="full"><button class="btn btn-red" type="submit">Save profile</button></div>
      </form>
    </section>
    <section class="form-card">
      <h2>Your seal</h2>
      <p style="margin-top:0">Your seal is the only key to your seat in the portal. If you think someone else has seen it, issue yourself a new one. The old seal stops working straight away.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-red" type="button" id="reseal">${icon('key')} Issue me a new seal</button>
        <button class="btn btn-line" type="button" id="signout">Sign out on this device</button>
      </div>
    </section>
  </div>`;

  main.querySelector('#profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.name.value.trim()) { f.name.focus(); return; }
    try {
      const r = await api.updateMember(seal, { id: m.id, name: f.name.value, title: f.title.value, party: f.party.value, bio: f.bio.value });
      updateMember(r);
      toast('Profile saved.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  main.querySelector('#reseal').addEventListener('click', async () => {
    if (!confirm('Issue yourself a new seal? Your current seal stops working at once, on every device.')) return;
    try {
      const s = await api.newSeal(seal, m.id);
      replaceSeal(s);
      sealModal(m, s, { self: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  main.querySelector('#signout').addEventListener('click', () => {
    signOut();
    ctx.navigate(to('/portal'), { replace: true });
  });
}
