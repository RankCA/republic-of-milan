// /parliament/members: the Members of Parliament, in the style of the cabinet cards.

import { api } from '../api.js';
import { hemicycle, icon } from '../art.js';
import { emptyState, loading } from '../components.js';
import { setTitle } from '../app.js';
import { esc, hueFor, initials } from '../util.js';

export async function render(main, { isCurrent }) {
  setTitle('Members of Parliament');
  main.innerHTML = loading('Calling the roll');
  const members = await api.listMembers();
  if (!isCurrent()) return;
  members.sort((a, b) => (b.role === 'keeper') - (a.role === 'keeper') || a.name.localeCompare(b.name));

  const parties = new Map();
  for (const m of members) parties.set(m.party || 'Independent', (parties.get(m.party || 'Independent') || 0) + 1);
  const groups = [...parties.entries()]
    .sort((a, b) => (a[0] === 'Independent') - (b[0] === 'Independent') || b[1] - a[1])
    .map(([label, count]) => ({ label, count, color: label === 'Independent' ? '#80612f' : `hsl(${hueFor(label)} 38% 36%)` }));

  main.innerHTML = `
  <section class="hero dark" aria-labelledby="mp-title" style="--rx:50%;--ry:110%">
    <div class="container" style="padding-block:clamp(40px,6vw,72px);text-align:center">
      <p class="eyebrow" style="justify-content:center">${icon('users')}<span>The Chamber</span></p>
      <h1 id="mp-title" style="margin:0;font-size:clamp(2.2rem,8vw,4rem)"><span class="the">The</span> <span>Members of</span> <span class="accent">Parliament</span></h1>
    </div>
  </section>
  <section class="section paper-alt">
    <div class="container">
      ${members.length ? `
      <div class="hemi-wrap">${members.length >= 5 ? hemicycle(groups, { width: 480 }) : ''}
        <div class="chips">${groups.map((g) => `<span class="chip"><i style="width:9px;height:9px;border-radius:50%;background:${g.color}"></i>${esc(g.label)} <span class="n">${g.count}</span></span>`).join('')}</div>
      </div>
      <ul class="members">
        ${members.map((m) => `
          <li class="minister${m.role === 'keeper' ? ' keeper' : ''}">
            <span class="mono" aria-hidden="true">${esc(initials(m.name))}</span>
            <span class="who">
              <span class="role">${esc(m.title || 'Member of Parliament')}</span>
              <strong class="name">${esc(m.name)}</strong>
              ${m.role === 'keeper' ? '<span class="role">Keeper of the Seals</span>' : ''}
              ${m.party ? `<span class="party">${esc(m.party)}</span>` : ''}
            </span>
            ${m.bio ? `<p class="bio">${esc(m.bio)}</p>` : ''}
          </li>`).join('')}
      </ul>` : emptyState('The benches are empty', 'Members appear here once the Keeper of the Seals has sworn them in.')}
    </div>
  </section>`;
}
