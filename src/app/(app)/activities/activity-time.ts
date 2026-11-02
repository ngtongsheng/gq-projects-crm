// Malaysia time is UTC+8 all year, so a typed local time maps straight to a UTC instant.
const MYT_SUFFIX = "+08:00";
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Reads a datetime-local value ("2026-11-02T09:30") as Malaysia time. Null if it is not a real date and time. */
export function parseMytInput(value: string): Date | null {
  if (!LOCAL_INPUT.test(value)) return null;
  const date = new Date(`${value}:00${MYT_SUFFIX}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The datetime-local value that shows a stored timestamp in Malaysia time. */
export function toMytInput(timestamp: string | Date): string {
  const shifted = new Date(new Date(timestamp).getTime() + MYT_OFFSET_MS);
  return shifted.toISOString().slice(0, 16);
}
