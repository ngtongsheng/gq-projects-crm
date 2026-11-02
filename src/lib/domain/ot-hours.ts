const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MINUTES = 24 * 60;

/** True for an "HH:MM" 24-hour time, the value of a time input. */
export const isClockTime = (value: string): boolean => CLOCK.test(value);

function toMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Hours worked between two "HH:MM" times, past midnight if the end is earlier than the start,
 * rounded to the nearest half hour (a quarter hour rounds up). Same start and end is 0.
 * Mirrors the set_ot_hours trigger in the ot_claims migration.
 */
export function otHours(from: string, to: string): number {
  let minutes = toMinutes(to) - toMinutes(from);
  if (minutes < 0) minutes += DAY_MINUTES;
  return Math.round(minutes / 30) / 2;
}
