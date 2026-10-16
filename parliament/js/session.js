// The signed-in MP: their seal lives in this browser only.

import { api } from './api.js';

const KEY = 'milan.seal';
let member = null;
const listeners = new Set();

export const getSeal = () => {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};

function setSeal(seal) {
  try {
    if (seal) localStorage.setItem(KEY, seal);
    else localStorage.removeItem(KEY);
  } catch { /* private mode: seal lasts for this page only */ }
}

export const currentMember = () => member;
export const onSessionChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(member));

export async function signIn(seal) {
  member = await api.me(seal);
  setSeal(seal.trim());
  emit();
  return member;
}

export function signOut() {
  member = null;
  setSeal('');
  emit();
}

/** Resolve the member for the stored seal, or null. Drops seals that stopped working. */
export async function restore() {
  const seal = getSeal();
  if (!seal) return null;
  if (member) return member;
  try {
    member = await api.me(seal);
  } catch (e) {
    if (e.status === 403 || e.code === '28000') setSeal('');
    member = null;
  }
  emit();
  return member;
}

export function updateMember(m) {
  member = { ...member, ...m };
  emit();
}

export function replaceSeal(seal) {
  setSeal(seal);
}
