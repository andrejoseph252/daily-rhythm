// Date helpers. Days are identified by local-time keys "YYYY-MM-DD".

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export const pad = n => String(n).padStart(2, '0');

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && toKey(fromKey(key)) === key;
}

export const todayKey = () => toKey(new Date());

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(key) {
  const w = fromKey(key).getDay();
  return w === 0 ? 7 : w;
}

export const weekStart = key => addDays(key, 1 - isoWeekday(key));

export const weekKeys = key => {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export function isoWeek(key) {
  const d = fromKey(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
}

export function dayOfYear(key) {
  const d = fromKey(key);
  return Math.round((d - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1;
}

export function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** 135 → "2h 15", 45 → "45m", 120 → "2h" */
export function formatMinutes(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${pad(m)}`;
}

/**
 * Accepts "1h30", "1h 30m", "1:30", "1.5", "1.5h", "90", "90m", "45 min", "2h".
 * Bare whole numbers up to 6 are read as hours, larger ones as minutes.
 * Returns minutes, or null if it can't be read.
 */
export function parseDuration(input) {
  const s = String(input).trim().toLowerCase().replace(',', '.');
  let m, min = null;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) min = +m[1] * 60 + +m[2];
  else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*(?:m(?:in)?)?)?$/))) min = Math.round(parseFloat(m[1]) * 60) + (m[2] ? +m[2] : 0);
  else if ((m = s.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/))) min = +m[1];
  else if (/^\d+\.\d+$/.test(s)) min = Math.round(parseFloat(s) * 60);
  else if (/^\d+$/.test(s)) min = +s <= 6 ? +s * 60 : +s;
  return min && min > 0 && min <= 16 * 60 ? min : null;
}
