// Daily Rhythm: routing, rendering, and wiring.

import {
  WEEKDAYS, WEEKDAYS_SHORT, MONTHS, todayKey, addDays, fromKey, isValidKey, isoWeekday,
  isoWeek, dayOfYear, daysInYear, weekKeys, formatMinutes, parseDuration,
} from './dates.js';
import { store, uid, isDue } from './store.js';
import { initSync, scheduleSync, syncNow, onStatus, getAuth, setAuth, status as syncStatus } from './sync.js';
import { quoteFor } from './quotes.js';
import { initFocus, openFocus, isFocusOpen } from './focus.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const state = { view: 'today', date: todayKey(), explicitDate: false };

// ---- Routing -----------------------------------------------------------

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  let m;
  if (h === 'settings') return { view: 'settings' };
  if (h === 'focus') return { view: 'today', date: todayKey(), explicitDate: false, focus: true };
  if ((m = h.match(/^week(?:\/(\d{4}-\d{2}-\d{2}))?$/))) {
    return { view: 'week', date: m[1] && isValidKey(m[1]) ? m[1] : state.date };
  }
  if (isValidKey(h)) return { view: 'today', date: h, explicitDate: true };
  return { view: 'today', date: todayKey(), explicitDate: false };
}

function route() {
  const prev = state.date;
  Object.assign(state, parseRoute());
  document.body.dataset.view = state.view;
  for (const v of ['today', 'week', 'settings']) {
    $(`view-${v}`).hidden = v !== state.view;
    $(`nav-${v}`).toggleAttribute('aria-current', v === state.view);
  }
  render();
  if (state.view === 'today' && prev !== state.date) slide(state.date > prev ? 'next' : 'prev');
  if (state.focus) {
    state.focus = false;
    history.replaceState(null, '', '#/');
    openFocus();
  }
}

const dayHref = key => key === todayKey() ? '#/' : `#/${key}`;
const go = hash => { location.hash = hash; };

function slide(dir) {
  const g = $('today-grid');
  g.classList.remove('slide-next', 'slide-prev');
  void g.offsetWidth;
  g.classList.add(`slide-${dir}`);
}

// ---- Shared helpers ----------------------------------------------------

function dueHabits(key) {
  const day = store.day(key);
  const wd = isoWeekday(key);
  return store.doc.habits.filter(h => (h.active && isDue(h, wd)) || day.habits[h.id]);
}

const workMinutes = day => day.blocks.reduce((s, b) => s + b.minutes, 0);

function relativeLabel(key) {
  const t = todayKey();
  if (key === t) return 'Today';
  if (key === addDays(t, -1)) return 'Yesterday';
  if (key === addDays(t, 1)) return 'Tomorrow';
  return '';
}

function subjects() {
  const counts = new Map();
  for (const d of Object.values(store.doc.days)) {
    for (const b of d.blocks) if (b.subject) counts.set(b.subject, (counts.get(b.subject) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

/** Set an input's value without disturbing someone typing in it. */
function setValue(input, value) {
  if (document.activeElement !== input && input.value !== value) input.value = value;
}

// ---- Render ------------------------------------------------------------

function render() {
  const focusKey = document.activeElement?.dataset?.fk;
  renderHero();
  if (state.view === 'today') renderToday();
  if (state.view === 'week') renderWeek();
  if (state.view === 'settings') renderSettings();
  renderSubjects();
  if (focusKey) document.querySelector(`[data-fk="${focusKey}"]`)?.focus({ preventScroll: true });
}

function renderHero() {
  const k = state.date;
  const d = fromKey(k);
  const q = quoteFor(state.view === 'today' ? k : todayKey());
  $('quote-text').textContent = q.text;
  $('quote-by').textContent = q.by;

  if (state.view === 'today') {
    const rel = relativeLabel(k);
    $('hero-numeral').textContent = d.getDate();
    $('hero-weekday').textContent = WEEKDAYS[isoWeekday(k) - 1] + (rel && rel !== 'Today' ? ` · ${rel}` : '');
    $('hero-month').textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    $('hero-count').textContent = `Week ${isoWeek(k)} · Day ${dayOfYear(k)} of ${daysInYear(d.getFullYear())}`;
    $('prev-day').href = dayHref(addDays(k, -1));
    $('next-day').href = dayHref(addDays(k, 1));
    $('go-today').toggleAttribute('aria-current', k === todayKey());
    $('go-today').href = '#/';
  } else if (state.view === 'week') {
    const keys = weekKeys(k);
    const a = fromKey(keys[0]), b = fromKey(keys[6]);
    $('page-eyebrow').textContent = `Week ${isoWeek(k)}`;
    $('page-title').textContent = a.getMonth() === b.getMonth()
      ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}`
      : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}`;
    $('prev-week').href = `#/week/${addDays(keys[0], -7)}`;
    $('next-week').href = `#/week/${addDays(keys[0], 7)}`;
    $('this-week').toggleAttribute('aria-current', keys.includes(todayKey()));
    $('week-nav').hidden = false;
  } else {
    $('page-eyebrow').textContent = 'Daily Rhythm';
    $('page-title').textContent = 'Settings';
    $('week-nav').hidden = true;
  }
}

function renderToday() {
  const k = state.date;
  const day = store.day(k);

  // Week strip
  const strip = $('weekstrip');
  strip.replaceChildren();
  const today = todayKey();
  for (const key of weekKeys(k)) {
    const d = store.day(key);
    const due = dueHabits(key);
    const a = el('a', 'weekstrip__day');
    a.href = dayHref(key);
    if (key === k) { a.classList.add('is-current'); a.setAttribute('aria-current', 'date'); }
    if (key > today) a.classList.add('is-future');
    if (key === today) a.classList.add('is-today');
    a.append(el('span', 'weekstrip__dow', WEEKDAYS_SHORT[isoWeekday(key) - 1]));
    a.append(el('span', 'weekstrip__num', String(fromKey(key).getDate())));
    const dots = el('span', 'weekstrip__dots');
    for (const h of due) dots.append(el('i', d.habits[h.id] ? 'on' : ''));
    a.append(dots);
    const min = workMinutes(d);
    a.append(el('span', 'weekstrip__hrs', min ? formatMinutes(min) : ' '));
    a.setAttribute('aria-label', `${WEEKDAYS[isoWeekday(key) - 1]} ${fromKey(key).getDate()}${min ? `, ${formatMinutes(min)} of work` : ''}`);
    strip.append(a);
  }

  // Today's three
  const items = $('three').querySelectorAll('.three__item');
  day.priorities.forEach((p, i) => {
    setValue(items[i].querySelector('.three__text'), p.text);
    items[i].querySelector('input[type=checkbox]').checked = p.done;
  });
  const filled = day.priorities.filter(p => p.text.trim()).length;
  const done = day.priorities.filter(p => p.done).length;
  $('three-aside').textContent = filled ? `${done} of ${filled} done` : '';

  // Habits
  const due = dueHabits(k);
  const list = $('habits');
  list.replaceChildren();
  if (!due.length) {
    list.append(el('li', 'habits__empty', 'Nothing scheduled today. Rest is part of the rhythm.'));
  }
  for (const h of due) {
    const li = el('li');
    const label = el('label', 'habit');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!day.habits[h.id];
    cb.dataset.habit = h.id;
    cb.dataset.fk = `h-${h.id}`;
    label.append(cb, el('span', 'habit__dot'), el('span', 'habit__label', h.label));
    li.append(label);
    list.append(li);
  }
  const hDone = due.filter(h => day.habits[h.id]).length;
  $('habits-aside').textContent = due.length ? `${hDone} of ${due.length}` : '';

  // Work
  const enough = store.doc.settings.enoughMinutes || 300;
  const total = workMinutes(day);
  const work = $('work');
  work.replaceChildren();
  for (const b of day.blocks) {
    const li = el('li', 'work__row');
    li.append(el('span', 'work__time', formatMinutes(b.minutes)));
    const subj = el('span', 'work__subject', b.subject);
    if (b.knit) {
      const knit = el('span', 'work__knit');
      knit.title = 'Finished in a focus session';
      subj.append(knit);
    }
    li.append(subj);
    const rm = el('button', 'work__remove', '×');
    rm.type = 'button';
    rm.dataset.block = b.id;
    rm.setAttribute('aria-label', `Remove ${formatMinutes(b.minutes)} of ${b.subject}`);
    li.append(rm);
    work.append(li);
  }
  $('work-aside').textContent = `${formatMinutes(total)} of ${formatMinutes(enough)}`;
  $('enough-fill').style.setProperty('--p', Math.min(1, total / enough));
  $('enough').classList.toggle('is-full', total >= enough);
  $('enough-label').textContent = `enough · ${formatMinutes(enough)}`;
  $('work-foot').textContent = total >= enough
    ? 'That’s enough for today. Close the books and rest.'
    : 'Steady work, then stop. Enough is a good day.';

  // Evening
  setValue($('note'), day.note);
}

function renderWeek() {
  const list = $('week-list');
  list.replaceChildren();
  const today = todayKey();
  let hours = 0, hDone = 0, hDue = 0, notes = 0, pieces = 0;

  for (const key of weekKeys(state.date)) {
    const d = store.day(key);
    const due = dueHabits(key);
    const min = workMinutes(d);
    const knits = d.blocks.filter(b => b.knit).length;
    hours += min; notes += d.note.trim() ? 1 : 0; pieces += knits;
    if (key <= today) { hDue += due.length; hDone += due.filter(h => d.habits[h.id]).length; }

    const li = el('li');
    const a = el('a', 'wrow');
    a.href = dayHref(key);
    if (key === today) a.classList.add('is-today');
    if (key > today) a.classList.add('is-future');

    const date = el('span', 'wrow__date');
    date.append(el('span', 'wrow__dow', WEEKDAYS_SHORT[isoWeekday(key) - 1]), el('span', 'wrow__num', String(fromKey(key).getDate())));

    const dots = el('span', 'wrow__habits');
    for (const h of due) {
      const i = el('i', d.habits[h.id] ? 'on' : '');
      i.title = h.label;
      dots.append(i);
    }

    const three = el('span', 'wrow__three');
    three.title = 'Today’s three';
    d.priorities.forEach(p => three.append(el('i', p.done ? 'on' : p.text.trim() ? 'set' : '')));

    const hrs = el('span', 'wrow__hrs', min ? formatMinutes(min) : '–');
    for (let n = 0; n < knits; n++) hrs.append(el('span', 'work__knit'));

    const note = el('span', 'wrow__note', d.note.trim() || '');
    a.append(date, dots, three, hrs, note);
    li.append(a);
    list.append(li);
  }

  const parts = [`${formatMinutes(hours)} of work`];
  if (hDue) parts.push(`${hDone} of ${hDue} habits`);
  parts.push(`${notes} evening note${notes === 1 ? '' : 's'}`);
  if (pieces) parts.push(`${pieces} knitted piece${pieces === 1 ? '' : 's'}`);
  $('week-sum').textContent = parts.join(' · ');
}

function renderSettings() {
  const theme = readTheme();
  document.querySelectorAll('input[name=theme]').forEach(r => { r.checked = r.value === theme; });

  // Habits editor
  const list = $('habit-edit');
  list.replaceChildren();
  for (const h of store.doc.habits.filter(x => x.active)) {
    const li = el('li', 'habit-edit__row');
    const name = el('input', 'field__input habit-edit__name');
    name.value = h.label;
    name.dataset.habitName = h.id;
    name.dataset.fk = `hn-${h.id}`;
    name.setAttribute('aria-label', 'Habit name');
    name.maxLength = 40;
    const days = el('span', 'daypick');
    WEEKDAYS_SHORT.forEach((w, i) => {
      const b = el('button', 'daypick__d', w[0]);
      b.type = 'button';
      b.title = WEEKDAYS[i];
      b.dataset.habitDay = `${h.id}:${i + 1}`;
      b.dataset.fk = `hd-${h.id}-${i}`;
      b.setAttribute('aria-pressed', String(h.days.includes(i + 1)));
      b.setAttribute('aria-label', `${h.label} on ${WEEKDAYS[i]}`);
      days.append(b);
    });
    const rm = el('button', 'work__remove habit-edit__rm', '×');
    rm.type = 'button';
    rm.dataset.habitRemove = h.id;
    rm.setAttribute('aria-label', `Remove ${h.label}`);
    li.append(name, days, rm);
    list.append(li);
  }

  const s = store.doc.settings;
  setValue($('set-enough'), String((s.enoughMinutes || 300) / 60));
  $('set-grace').value = String(s.focusGraceSeconds || 15);
  $('set-chime').checked = !!s.focusChime;
  $('set-away').checked = !!s.focusAllowAway;
  $('set-grace').disabled = !!s.focusAllowAway;

  const auth = getAuth();
  setValue($('set-gist'), auth?.gistId || '');
  const tok = $('set-token');
  if (document.activeElement !== tok && (!tok.value || tok.value.startsWith('••'))) {
    tok.value = auth ? '••••••••' + auth.token.slice(-4) : '';
  }
  $('sync-forget').hidden = !auth;
  renderSyncDetail();
}

function renderSubjects() {
  const dl = $('subjects');
  const want = subjects().slice(0, 30);
  if (dl.dataset.sig === want.join('|')) return;
  dl.dataset.sig = want.join('|');
  dl.replaceChildren(...want.map(s => { const o = el('option'); o.value = s; return o; }));
}

// ---- Sync status -------------------------------------------------------

const STATUS_TEXT = {
  local: 'saved on this device',
  saving: 'saving…',
  syncing: 'syncing…',
  synced: 'saved',
  offline: 'offline · saved here',
  failed: 'sync failed',
};

function renderSync(s) {
  const p = $('sync');
  p.dataset.state = s.state;
  p.querySelector('.sync__text').textContent = STATUS_TEXT[s.state] || s.state;
  p.title = s.error || '';
  if (state.view === 'settings') renderSyncDetail();
}

function renderSyncDetail() {
  const s = syncStatus;
  const auth = getAuth();
  const msg = !auth ? 'Not connected. Everything is kept on this device for now.'
    : s.state === 'failed' ? s.error
    : s.state === 'synced' ? 'Connected. Your notebook is in sync.'
    : s.state === 'offline' ? 'Offline. Changes will sync when you’re back online.'
    : 'Syncing…';
  $('sync-detail').textContent = msg;
  $('sync-detail').dataset.state = s.state;
}

// ---- Theme -------------------------------------------------------------

function readTheme() {
  try { return localStorage.getItem('rhythm.theme') || 'system'; } catch { return 'system'; }
}

function applyTheme(t) {
  try { localStorage.setItem('rhythm.theme', t); } catch { /* ignore */ }
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  updateThemeColor();
}

function updateThemeColor() {
  const desk = getComputedStyle(document.documentElement).getPropertyValue('--desk').trim();
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', desk);
}

// ---- Events ------------------------------------------------------------

function wireToday() {
  const three = $('three');
  three.addEventListener('input', e => {
    const t = e.target;
    if (!t.classList.contains('three__text')) return;
    store.updateDay(state.date, d => { d.priorities[+t.dataset.i].text = t.value; });
  });
  three.addEventListener('change', e => {
    const t = e.target;
    if (t.type !== 'checkbox') return;
    store.updateDay(state.date, d => { d.priorities[+t.dataset.i].done = t.checked; });
  });
  three.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.classList.contains('three__text')) return;
    e.preventDefault();
    const i = +e.target.dataset.i;
    const next = three.querySelector(`.three__text[data-i="${i + 1}"]`);
    next ? next.focus() : e.target.blur();
  });

  $('habits').addEventListener('change', e => {
    const id = e.target.dataset.habit;
    if (!id) return;
    store.updateDay(state.date, d => {
      if (e.target.checked) d.habits[id] = true;
      else delete d.habits[id];
    });
  });

  $('work-add').addEventListener('submit', e => {
    e.preventDefault();
    const timeIn = $('work-time'), subjIn = $('work-subject');
    const minutes = parseDuration(timeIn.value);
    const subject = subjIn.value.trim();
    timeIn.classList.toggle('is-invalid', !minutes);
    subjIn.classList.toggle('is-invalid', !subject);
    if (!minutes) { timeIn.title = 'Try 1h30, 90, 1:30 or 45m'; timeIn.focus(); return; }
    if (!subject) { subjIn.focus(); return; }
    store.updateDay(state.date, d => { d.blocks.push({ id: uid(), minutes, subject }); });
    timeIn.value = subjIn.value = '';
    timeIn.focus();
  });
  for (const id of ['work-time', 'work-subject']) {
    $(id).addEventListener('input', e => e.target.classList.remove('is-invalid'));
  }

  $('work').addEventListener('click', e => {
    const id = e.target.dataset.block;
    if (!id) return;
    store.updateDay(state.date, d => { d.blocks = d.blocks.filter(b => b.id !== id); });
  });

  $('note').addEventListener('input', e => {
    store.updateDay(state.date, d => { d.note = e.target.value; });
  });
  $('note').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
}

function wireSettings() {
  $('theme-choice').addEventListener('change', e => applyTheme(e.target.value));

  $('habit-edit').addEventListener('input', e => {
    const id = e.target.dataset.habitName;
    if (!id) return;
    store.updateMeta(doc => { doc.habits.find(h => h.id === id).label = e.target.value; });
  });
  $('habit-edit').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.habitDay) {
      const [id, wd] = t.dataset.habitDay.split(':');
      store.updateMeta(doc => {
        const h = doc.habits.find(x => x.id === id);
        const n = +wd;
        if (h.days.includes(n)) { if (h.days.length > 1) h.days = h.days.filter(x => x !== n); }
        else h.days = [...h.days, n].sort();
      });
    }
    if (t.dataset.habitRemove) {
      store.updateMeta(doc => { doc.habits.find(h => h.id === t.dataset.habitRemove).active = false; });
    }
  });
  $('habit-add').addEventListener('submit', e => {
    e.preventDefault();
    const label = $('habit-new').value.trim();
    if (!label) return;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'habit';
    store.updateMeta(doc => { doc.habits.push({ id: `${slug}-${uid().slice(0, 4)}`, label, active: true, days: [1, 2, 3, 4, 5, 6, 7] }); });
    $('habit-new').value = '';
  });

  $('set-enough').addEventListener('change', e => {
    const h = Math.min(12, Math.max(0.5, parseFloat(e.target.value) || 5));
    store.updateMeta(doc => { doc.settings.enoughMinutes = Math.round(h * 60); });
  });
  $('set-grace').addEventListener('change', e => {
    store.updateMeta(doc => { doc.settings.focusGraceSeconds = +e.target.value; });
  });
  $('set-away').addEventListener('change', e => {
    store.updateMeta(doc => { doc.settings.focusAllowAway = e.target.checked; });
  });
  $('set-chime').addEventListener('change', e => {
    store.updateMeta(doc => { doc.settings.focusChime = e.target.checked; });
  });

  $('set-token').addEventListener('focus', e => { if (e.target.value.startsWith('••')) e.target.value = ''; });
  $('sync-form').addEventListener('submit', e => {
    e.preventDefault();
    const tokenIn = $('set-token').value.trim();
    const token = tokenIn && !tokenIn.startsWith('••') ? tokenIn : getAuth()?.token;
    const gistId = $('set-gist').value.trim().replace(/^.*gist\.github\.com\/(?:[^/]+\/)?/, '').replace(/[/?#].*$/, '');
    if (!token || !gistId) {
      $('sync-detail').textContent = 'Both the token and the gist ID are needed.';
      return;
    }
    setAuth({ token, gistId });
    $('set-token').value = '';
    syncNow();
    renderSettings();
  });
  $('sync-forget').addEventListener('click', () => {
    setAuth(null);
    renderSettings();
  });

  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.doc, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `daily-rhythm-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function wireNavigation() {
  window.addEventListener('hashchange', route);

  document.addEventListener('keydown', e => {
    if (isFocusOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.matches?.('input, textarea, select, [contenteditable]')) {
      if (e.key === 'Escape') t.blur();
      return;
    }
    const k = e.key.toLowerCase();
    if (state.view === 'today' && e.key === 'ArrowLeft') go(dayHref(addDays(state.date, -1)));
    else if (state.view === 'today' && e.key === 'ArrowRight') go(dayHref(addDays(state.date, 1)));
    else if (state.view === 'week' && e.key === 'ArrowLeft') go(`#/week/${addDays(state.date, -7)}`);
    else if (state.view === 'week' && e.key === 'ArrowRight') go(`#/week/${addDays(state.date, 7)}`);
    else if (k === 't') go('#/');
    else if (k === 'w') go(`#/week/${state.date}`);
    else if (k === 'f') { e.preventDefault(); openFocus(); }
    else return;
  });

  // Swipe between days on the Today view.
  let sx = 0, sy = 0, st = 0, tracking = false;
  const area = $('view-today');
  area.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('input, button, .weekstrip')) { tracking = false; return; }
    tracking = true;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  area.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Date.now() - st < 700) {
      go(dayHref(addDays(state.date, dx < 0 ? 1 : -1)));
    }
  }, { passive: true });

  // Roll over to the new day if the tab was left open overnight.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.view === 'today' && !state.explicitDate && state.date !== todayKey()) route();
  });

  // Week links in the footer remember which week we're looking at.
  $('nav-week').addEventListener('click', e => { e.preventDefault(); go(`#/week/${state.date}`); });
}

// ---- Boot --------------------------------------------------------------

store.subscribe(({ local }) => {
  render();
  if (local) scheduleSync();
});

onStatus(renderSync);

initFocus({
  settings: () => store.doc.settings,
  onLog(dateKey, minutes, subject, knit) {
    store.updateDay(dateKey, d => { d.blocks.push({ id: uid(), minutes, subject, ...(knit ? { knit: true } : {}) }); });
  },
});

wireToday();
wireSettings();
wireNavigation();
route();
updateThemeColor();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', updateThemeColor);
initSync();
