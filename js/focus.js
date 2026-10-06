// Focus sessions: a quiet timer that knits while you work.
// Leave the page for longer than the grace period and the piece slips off the needle.

import { drawKnit } from './knit.js?v=202610070145';
import { pad, todayKey } from './dates.js?v=202610070145';

const SESSION_KEY = 'rhythm.focus';
const PREFS_KEY = 'rhythm.focusPrefs';
const STEP = 5, MIN_LEN = 5, MAX_LEN = 180;

const $ = id => document.getElementById(id);

let opts;            // { onLog(dateKey, minutes, subject, knit), settings() }
let session = null;  // { subject, minutes, dateKey, startedAt, lastSeen, state, stoppedAt }
let uiState = 'closed';
let tickTimer = null;
let wakeLock = null;
let audio = null;
let chosenMinutes = 45;

// ---- Persistence -------------------------------------------------------

const save = () => {
  try { session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY); }
  catch { /* ignore */ }
};

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// ---- Time --------------------------------------------------------------

const graceMs = () => (opts.settings().focusGraceSeconds || 15) * 1000;
const allowAway = () => !!opts.settings().focusAllowAway;
const durationMs = () => session.minutes * 60000;
const elapsedMs = (at = Date.now()) => Math.min(durationMs(), Math.max(0, at - session.startedAt));
const progress = (at) => elapsedMs(at) / durationMs();

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}


/** Logged time rounds up to the next 5 minutes, once at least a minute has passed. */
const loggable = ms => ms < 60000 ? 0 : Math.min(session.minutes, Math.ceil(ms / 60000 / STEP) * STEP);

/** Decide what happened while we weren't looking (tab hidden, page reloaded). */
function reconcile() {
  if (!session || session.state !== 'running') return;
  const now = Date.now();
  const end = session.startedAt + durationMs();
  const away = now - session.lastSeen;
  if (away > graceMs() && !allowAway()) {
    if (session.lastSeen + graceMs() >= end) return complete();
    session.state = 'broken';
    session.stoppedAt = session.lastSeen;
    save();
    return show('broken');
  }
  if (now >= end) return complete();
  session.lastSeen = now;
  save();
}

// ---- Lifecycle ---------------------------------------------------------

function start() {
  const subject = $('focus-subject').value.trim();
  if (!subject) { $('focus-subject').focus(); $('focus-subject').classList.add('is-invalid'); return; }
  const now = Date.now();
  session = { subject, minutes: chosenMinutes, dateKey: todayKey(), startedAt: now, lastSeen: now, state: 'running' };
  savePrefs({ subject, minutes: chosenMinutes });
  save();
  prepareAudio();
  requestWakeLock();
  show('running');
}

function complete() {
  session.state = 'done';
  session.stoppedAt = session.startedAt + durationMs();
  save();
  opts.onLog(session.dateKey, session.minutes, session.subject, true);
  if (opts.settings().focusChime) chime();
  show('done');
}

function logPartialAndClose() {
  const min = loggable(elapsedMs(session.stoppedAt ?? Date.now()));
  if (min >= 1) opts.onLog(session.dateKey, min, session.subject, false);
  close();
}

function close() {
  session = null;
  save();
  releaseWakeLock();
  show('closed');
}

// ---- Rendering ---------------------------------------------------------

function show(state) {
  uiState = state;
  const el = $('focus');
  clearInterval(tickTimer);
  tickTimer = null;

  if (state === 'closed') {
    el.hidden = true;
    document.body.classList.remove('is-focusing');
    document.title = 'Daily Rhythm';
    $('focus-open').focus({ preventScroll: true });
    return;
  }

  el.hidden = false;
  el.dataset.state = state;
  document.body.classList.add('is-focusing');

  const eyebrow = $('focus-eyebrow'), msg = $('focus-msg'), actions = $('focus-actions');
  actions.replaceChildren();
  const button = (label, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.append(b);
    return b;
  };

  if (state === 'setup') {
    eyebrow.textContent = 'Focus';
    $('focus-time').textContent = clock(chosenMinutes * 60000);
    requestAnimationFrame(() => setDial(chosenMinutes, false));
    msg.textContent = allowAway()
      ? 'Lock your phone if you like. The knitting carries on while you work.'
      : `Stay on this page while you work. Step away for more than ${opts.settings().focusGraceSeconds} seconds and the yarn slips off the needle.`;
    button('Not now', 'btn btn--quiet', close);
    button('Begin', 'btn btn--primary', start);
    drawKnit($('knit'), 0);
    setTimeout(() => $('focus-subject').focus(), 30);
    return;
  }

  if (state === 'running') {
    eyebrow.textContent = session.subject;
    msg.textContent = 'One stitch at a time.';
    button('End early', 'btn btn--quiet', () => show('confirm'));
    tick();
    tickTimer = setInterval(tick, 1000);
    return;
  }

  if (state === 'confirm') {
    const min = loggable(elapsedMs());
    eyebrow.textContent = session.subject;
    msg.textContent = min >= 1
      ? `End now? ${min} minutes will be logged, but this piece stays unfinished.`
      : 'End now? Less than a minute has passed, so nothing will be logged.';
    button('Keep knitting', 'btn btn--quiet', () => show('running'));
    button(min >= 1 ? `End & log ${min}m` : 'End', 'btn btn--primary', () => {
      session.stoppedAt = Date.now();
      logPartialAndClose();
    });
    tick();
    tickTimer = setInterval(tick, 1000);
    return;
  }

  if (state === 'done') {
    eyebrow.textContent = 'Finished';
    $('focus-time').textContent = clock(durationMs());
    msg.textContent = `A finished piece. ${session.minutes} minutes of ${session.subject}, logged.`;
    button('Back to the day', 'btn btn--primary', close);
    drawKnit($('knit'), 1);
    document.title = 'Finished · Daily Rhythm';
    return;
  }

  if (state === 'broken') {
    const min = loggable(elapsedMs(session.stoppedAt));
    eyebrow.textContent = 'Interrupted';
    $('focus-time').textContent = clock(durationMs() - elapsedMs(session.stoppedAt));
    msg.textContent = min >= 1
      ? `You stepped away, and the yarn slipped off the needle. The time before still counts: ${min} minutes.`
      : 'You stepped away, and the yarn slipped off the needle.';
    if (min >= 1) {
      button('Let it go', 'btn btn--quiet', close);
      button(`Log ${min}m`, 'btn btn--primary', logPartialAndClose);
    } else {
      button('Back to the day', 'btn btn--primary', close);
    }
    drawKnit($('knit'), progress(session.stoppedAt), { faded: true });
    releaseWakeLock();
    document.title = 'Interrupted · Daily Rhythm';
  }
}

function tick() {
  if (!session || session.state !== 'running') return;
  if (document.visibilityState === 'visible') {
    reconcile();
    if (session?.state !== 'running') return;
  }
  const left = durationMs() - elapsedMs();
  $('focus-time').textContent = clock(left);
  document.title = `${clock(left)} · ${session.subject}`;
  drawKnit($('knit'), progress());
}

// ---- Length dial -------------------------------------------------------

const dialValues = Array.from({ length: (MAX_LEN - MIN_LEN) / STEP + 1 }, (_, i) => MIN_LEN + i * STEP);
const dialLabel = m => m < 60 ? String(m) : `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}`;
let dialStep = 0;

function buildDial() {
  const track = $('dial');
  track.replaceChildren(...dialValues.map(m => {
    const t = document.createElement('button');
    t.type = 'button';
    t.tabIndex = -1;
    t.className = 'dial__tick' + (m % 15 === 0 ? ' dial__tick--major' : '');
    t.dataset.min = m;
    t.setAttribute('aria-label', `${m} minutes`);
    if (m % 15 === 0) {
      const label = document.createElement('span');
      label.textContent = dialLabel(m);
      t.append(label);
    }
    return t;
  }));
}

function setDial(min, smooth = true) {
  const track = $('dial');
  const i = dialValues.indexOf(Math.min(MAX_LEN, Math.max(MIN_LEN, Math.round(min / STEP) * STEP)));
  dialStep = track.firstElementChild.offsetWidth;
  track.scrollTo({ left: i * dialStep, behavior: smooth ? 'smooth' : 'instant' });
  readDial(i);
}

function readDial(i = Math.round($('dial').scrollLeft / (dialStep || 1))) {
  const idx = Math.min(dialValues.length - 1, Math.max(0, i));
  chosenMinutes = dialValues[idx];
  const track = $('dial');
  track.setAttribute('aria-valuenow', chosenMinutes);
  track.setAttribute('aria-valuetext', `${chosenMinutes} minutes`);
  track.querySelector('.is-selected')?.classList.remove('is-selected');
  track.children[idx]?.classList.add('is-selected');
  if (uiState === 'setup') $('focus-time').textContent = clock(chosenMinutes * 60000);
}

function wireDial() {
  const track = $('dial');
  buildDial();
  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => readDial());
  }, { passive: true });
  track.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    track.scrollLeft += e.deltaY;
  }, { passive: false });
  track.addEventListener('click', e => {
    const t = e.target.closest('.dial__tick');
    if (t) setDial(+t.dataset.min);
  });
  track.addEventListener('keydown', e => {
    const d = { ArrowLeft: -STEP, ArrowDown: -STEP, ArrowRight: STEP, ArrowUp: STEP, PageDown: -30, PageUp: 30 }[e.key];
    if (d) { e.preventDefault(); setDial(chosenMinutes + d); }
    if (e.key === 'Home') { e.preventDefault(); setDial(MIN_LEN); }
    if (e.key === 'End') { e.preventDefault(); setDial(MAX_LEN); }
    if (e.key === 'Enter') start();
  });
}

// ---- Wake lock & chime -------------------------------------------------

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* not allowed here; fine */ }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function prepareAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { audio = null; }
}

function chime() {
  if (!audio) return;
  const t0 = audio.currentTime + 0.05;
  [[523.25, 0], [659.25, 0.45], [783.99, 0.9]].forEach(([freq, at]) => {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0 + at);
    gain.gain.linearRampToValueAtTime(0.09, t0 + at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 2.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 2.3);
  });
}

// ---- Public ------------------------------------------------------------

export function openFocus() {
  if (uiState !== 'closed') return;
  const prefs = loadPrefs();
  chosenMinutes = Math.min(MAX_LEN, Math.max(MIN_LEN, Math.round((prefs.minutes || 45) / STEP) * STEP));
  $('focus-subject').value = prefs.subject || '';
  $('focus-subject').classList.remove('is-invalid');
  show('setup');
}

export const isFocusOpen = () => uiState !== 'closed';

export function initFocus(options) {
  opts = options;

  $('focus-open').addEventListener('click', openFocus);

  wireDial();

  $('focus-subject').addEventListener('input', e => e.target.classList.remove('is-invalid'));
  $('focus-subject').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && uiState === 'setup') close();
    if (e.key === 'Escape' && uiState === 'confirm') show('running');
  });

  document.addEventListener('visibilitychange', () => {
    if (!session || session.state !== 'running') return;
    if (document.visibilityState === 'hidden') {
      session.lastSeen = Date.now();
      save();
    } else {
      reconcile();
      if (session?.state === 'running') { requestWakeLock(); tick(); }
    }
  });

  window.addEventListener('beforeunload', e => {
    if (session?.state === 'running') {
      session.lastSeen = Date.now();
      save();
      e.preventDefault();
      e.returnValue = '';
    }
  });

  window.addEventListener('resize', () => {
    if (uiState === 'closed') return;
    if (uiState === 'setup') setDial(chosenMinutes, false);
    const p = session ? progress(session.stoppedAt ?? Date.now()) : 0;
    drawKnit($('knit'), uiState === 'done' ? 1 : p, { faded: uiState === 'broken' });
  });

  // Resume a session that survived a reload.
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { session = null; }
  if (session?.state === 'running') {
    show('running');
    reconcile();
    if (session?.state === 'running') requestWakeLock();
  } else if (session?.state === 'broken') {
    show('broken');
  } else if (session?.state === 'done') {
    show('done');
  } else {
    session = null;
    save();
  }
}
