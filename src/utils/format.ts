const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const liters = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export const formatMl = (ml: number) => integer.format(Math.round(ml));
export const formatLiters = (ml: number) => liters.format(ml / 1000);
export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatWeekdayDate = (date: Date) => weekdayDate.format(date);
export const formatLongDate = (date: Date) => longDate.format(date);
export const formatMonthYear = (date: Date) => monthYear.format(date);
export const formatShortDate = (date: Date) => shortDate.format(date);

export function formatInterval(minutes: number) {
  const hours = minutes / 60;
  return hours === 1 ? 'Every hour' : `Every ${liters.format(hours)} hours`;
}

/** "alex.water" → "AW" */
export function initials(username: string) {
  const parts = username.split(/[._\-\s]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : username.slice(0, 2);
  return letters.toUpperCase();
}

export function displayName(username: string) {
  const first = username.split(/[._\-\s]+/)[0] ?? username;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Parse a YYYY-MM-DD day as a local date (not UTC midnight). */
export function parseDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}
