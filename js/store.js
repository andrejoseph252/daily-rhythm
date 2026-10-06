// In-memory state, the localStorage cache, and the data schema.

const CACHE_KEY = 'rhythm.data';

const DEFAULT_HABITS = [
  { id: 'walk',    label: 'Walk',        active: true, days: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'cooked',  label: 'Cooked meal', active: true, days: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'reading', label: 'Reading',     active: true, days: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'bed',     label: 'Bed on time', active: true, days: [1, 2, 3, 4, 5, 6, 7] },
];

const DEFAULT_SETTINGS = {
  enoughMinutes: 300,
  focusChime: true,
  focusGraceSeconds: 15,
  focusAllowAway: false,
};

export function emptyDoc() {
  return {
    version: 1,
    updatedAt: null,
    metaUpdatedAt: null,
    settings: { ...DEFAULT_SETTINGS },
    habits: DEFAULT_HABITS.map(h => ({ ...h, days: [...h.days] })),
    days: {},
  };
}

export function emptyDay() {
  return {
    priorities: [0, 1, 2].map(() => ({ text: '', done: false })),
    habits: {},
    blocks: [],
    note: '',
    updatedAt: null,
  };
}

/** Fill in anything missing, so older or hand-made files still load. */
export function normalize(raw) {
  const doc = emptyDoc();
  if (!raw || typeof raw !== 'object') return doc;
  doc.updatedAt = raw.updatedAt ?? null;
  doc.metaUpdatedAt = raw.metaUpdatedAt ?? null;
  doc.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  if (Array.isArray(raw.habits)) {
    doc.habits = raw.habits.map(h => ({
      id: String(h.id),
      label: String(h.label ?? ''),
      active: h.active !== false,
      days: Array.isArray(h.days) && h.days.length ? h.days : [1, 2, 3, 4, 5, 6, 7],
    }));
  }
  for (const [key, d] of Object.entries(raw.days || {})) {
    const day = emptyDay();
    (d.priorities || []).slice(0, 3).forEach((p, i) => {
      day.priorities[i] = { text: String(p.text ?? ''), done: !!p.done };
    });
    day.habits = { ...(d.habits || {}) };
    day.blocks = (d.blocks || []).map(b => ({
      id: b.id || uid(),
      minutes: Math.max(0, Math.round(+b.minutes || 0)),
      subject: String(b.subject ?? ''),
      ...(b.knit ? { knit: true } : {}),
    }));
    day.note = String(d.note ?? '');
    day.updatedAt = d.updatedAt ?? null;
    doc.days[key] = day;
  }
  return doc;
}

/** Per-day last-write-wins; habits and settings travel together. */
export function merge(local, remote) {
  const a = normalize(local), b = normalize(remote);
  if ((b.metaUpdatedAt || '') > (a.metaUpdatedAt || '')) {
    a.habits = b.habits;
    a.settings = b.settings;
    a.metaUpdatedAt = b.metaUpdatedAt;
  }
  for (const [key, day] of Object.entries(b.days)) {
    const mine = a.days[key];
    if (!mine || (day.updatedAt || '') > (mine.updatedAt || '')) a.days[key] = day;
  }
  if ((b.updatedAt || '') > (a.updatedAt || '')) a.updatedAt = b.updatedAt;
  return a;
}

export const uid = () => Math.random().toString(36).slice(2, 9);

export const isDue = (habit, weekday) => habit.days.includes(weekday);

// ---- Store -------------------------------------------------------------

const listeners = new Set();

function readCache() {
  try { return normalize(JSON.parse(localStorage.getItem(CACHE_KEY))); }
  catch { return emptyDoc(); }
}

function writeCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(store.doc)); }
  catch { /* storage full or blocked: the in-memory copy still works */ }
}

function emit(opts) {
  for (const fn of listeners) fn(opts);
}

export const store = {
  doc: readCache(),

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  day(key) { return this.doc.days[key] || emptyDay(); },

  updateDay(key, fn) {
    const day = this.doc.days[key] || (this.doc.days[key] = emptyDay());
    fn(day);
    day.updatedAt = this.doc.updatedAt = new Date().toISOString();
    writeCache();
    emit({ local: true });
  },

  updateMeta(fn) {
    fn(this.doc);
    this.doc.metaUpdatedAt = this.doc.updatedAt = new Date().toISOString();
    writeCache();
    emit({ local: true });
  },

  /** Used by sync after merging with the gist. */
  replace(doc) {
    this.doc = normalize(doc);
    writeCache();
    emit({ local: false });
  },
};
