// Shared parts of the Members' portal: the entrance (sign in) and the portal header.

import { api } from '../api.js';
import { crest, icon } from '../art.js';
import { loading } from '../components.js';
import { setTitle } from '../app.js';
import { restore, signIn } from '../session.js';
import { esc, to } from '../util.js';

/** Returns the signed-in member, or shows the entrance and returns null. */
export async function requireMember(main, { navigate }) {
  main.innerHTML = loading('Checking your seal');
  const m = await restore();
  if (m) return m;
  setTitle("Members' Entrance");
  main.innerHTML = `
  <section class="hero dark entrance">
    <div class="entrance-card">
      ${crest(48)}
      <h1>Members' Entrance</h1>
      <p>Present your seal to enter the Chamber.</p>
      ${api.name === 'fake' ? '<p class="notice fake" style="margin-top:14px">Local test archive. Use seal FAKE-KEEP or FAKE-MP01.</p>' : ''}
      <form id="entrance" autocomplete="off">
        <label class="sr-only" for="seal">Your seal</label>
        <input class="seal-input" id="seal" name="seal" placeholder="MIL-XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" required>
        <p class="form-error" id="err" role="alert"></p>
        <button class="btn btn-red btn-lg" type="submit">${icon('key')} Enter the Chamber</button>
      </form>
      <p class="note">Seals are issued by the Keeper of the Seals. If you have lost yours, ask the Keeper for a new one.</p>
    </div>
  </section>`;
  const form = main.querySelector('#entrance');
  const input = main.querySelector('#seal');
  input.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    main.querySelector('#err').textContent = '';
    try {
      await signIn(input.value);
      navigate(location.pathname + location.search, { replace: true });
    } catch (err) {
      main.querySelector('#err').textContent = err.status === 403 || err.code === '28000' ? 'That seal is not recognised. Check it and try again.' : err.message;
      btn.disabled = false;
      input.select();
    }
  });
  return null;
}

export function portalHead(m, active, title, tools = '') {
  const links = [
    [to('/portal'), 'Acts', 'acts'],
    [to('/portal/new'), 'Table an act', 'new'],
    [to('/portal/profile'), 'My profile', 'profile'],
    m.role === 'keeper' ? [to('/portal/seals'), 'Members and seals', 'seals'] : null,
  ].filter(Boolean);
  return `<section class="hero dark portal-head" style="--rx:90%;--ry:0%">
    <div class="container">
      <div>
        <p class="eyebrow">${icon('key')}<span>Members' Portal${api.name === 'fake' ? ' (local test archive)' : ''}</span></p>
        <h1>${title}</h1>
        <nav class="portal-nav" aria-label="Portal">${links.map(([href, label, key]) => `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      </div>
      <div class="tools">${tools}</div>
    </div>
  </section>`;
}

export const hon = (m) => `Hon. ${esc(m.name)}`;
