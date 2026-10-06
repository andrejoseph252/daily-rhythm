// GitHub Gist sync. The token and gist ID live only in this device's localStorage.

import { store, merge, normalize } from './store.js?v=202610070145';

const AUTH_KEY = 'rhythm.auth';
const FILE = 'data.json';
const DEBOUNCE_MS = 1500;

let timer = null;
let dirty = false;
let inflight = false;
let again = false;
let lastError = '';
const listeners = new Set();

export const status = { state: 'local', error: '' };

function setStatus(state, error = '') {
  status.state = state;
  status.error = error;
  for (const fn of listeners) fn(status);
}

export const onStatus = fn => { listeners.add(fn); fn(status); };

export function getAuth() {
  try {
    const a = JSON.parse(localStorage.getItem(AUTH_KEY));
    return a && a.token && a.gistId ? a : null;
  } catch { return null; }
}

export function setAuth(auth) {
  try {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  } catch { /* ignore */ }
  setStatus(auth ? 'saving' : 'local');
}

const headers = auth => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${auth.token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

function describe(res) {
  if (res.status === 401) return 'The token was refused. Check it hasn’t expired.';
  if (res.status === 403) return 'GitHub denied access. The token needs the Gists permission.';
  if (res.status === 404) return 'Gist not found. Check the gist ID, and that the token belongs to its owner.';
  return `GitHub answered ${res.status}.`;
}

async function pull(auth) {
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(auth.gistId)}`, {
    headers: headers(auth), cache: 'no-store',
  });
  if (!res.ok) throw new Error(describe(res));
  const gist = await res.json();
  const file = gist.files?.[FILE];
  if (!file) return null;
  let content = file.content;
  if (file.truncated) content = await (await fetch(file.raw_url, { cache: 'no-store' })).text();
  if (!content || !content.trim()) return null;
  return JSON.parse(content);
}

async function push(auth, doc) {
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(auth.gistId)}`, {
    method: 'PATCH',
    headers: { ...headers(auth), 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(doc, null, 1) } } }),
  });
  if (!res.ok) throw new Error(describe(res));
}

/** Pull, merge day by day, push back if anything differs. */
export async function syncNow() {
  clearTimeout(timer);
  dirty = false;
  const auth = getAuth();
  if (!auth) return setStatus('local');
  if (!navigator.onLine) return setStatus('offline');
  if (inflight) { again = true; return; }

  inflight = true;
  setStatus('syncing');
  try {
    const remote = await pull(auth);
    const merged = remote ? merge(store.doc, remote) : normalize(store.doc);
    if (JSON.stringify(merged) !== JSON.stringify(store.doc)) store.replace(merged);
    if (!remote || JSON.stringify(normalize(remote)) !== JSON.stringify(merged)) {
      await push(auth, merged);
    }
    lastError = '';
    setStatus(dirty ? 'saving' : 'synced');
  } catch (err) {
    lastError = err instanceof SyntaxError ? 'data.json in the gist isn’t valid JSON.' : (err.message || 'Network error.');
    console.warn('[rhythm] sync failed:', err);
    setStatus(navigator.onLine ? 'failed' : 'offline', lastError);
  } finally {
    inflight = false;
    if (again) { again = false; syncNow(); }
  }
}

export function scheduleSync() {
  if (!getAuth()) return setStatus('local');
  dirty = true;
  setStatus('saving');
  clearTimeout(timer);
  timer = setTimeout(syncNow, DEBOUNCE_MS);
}

export function initSync() {
  window.addEventListener('online', syncNow);
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
    else if (dirty) syncNow(); // flush pending edits before the tab sleeps
  });
  syncNow();
}
