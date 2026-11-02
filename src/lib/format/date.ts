// Calendar days are "YYYY-MM-DD" strings (Postgres `date`). Malaysia time is UTC+8 all year, no DST.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type CalendarDate = string;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toUtcMs(date: CalendarDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): CalendarDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayMyt(now: Date = new Date()): CalendarDate {
  return fromUtcMs(now.getTime() + MYT_OFFSET_MS);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

// 0 = Sunday ... 6 = Saturday
export function dayOfWeek(date: CalendarDate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

export function formatDate(date: CalendarDate): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

// Takes a timestamp (ISO string or Date) and shows it in Malaysia time, e.g. "2 Nov 2026, 9:00 AM".
export function formatDateTime(timestamp: string | Date): string {
  const shifted = new Date(new Date(timestamp).getTime() + MYT_OFFSET_MS);
  const hours = shifted.getUTCHours();
  const clock = `${hours % 12 || 12}:${pad(shifted.getUTCMinutes())} ${hours >= 12 ? "PM" : "AM"}`;
  return `${formatDate(fromUtcMs(shifted.getTime()))}, ${clock}`;
}
