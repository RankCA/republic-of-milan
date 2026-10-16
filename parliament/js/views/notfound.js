import { emptyState } from '../components.js';
import { setTitle } from '../app.js';
import { to } from '../util.js';

export function render(main) {
  setTitle('Page not found');
  main.innerHTML = `<section class="section paper"><div class="container">${emptyState('This corridor leads nowhere', 'The page you asked for is not part of the Parliament.', `<a class="btn btn-line" href="${to('')}">Return to the Register</a>`)}</div></section>`;
}
