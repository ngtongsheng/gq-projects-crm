const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for an "HH:MM" 24-hour time, the value of a time input. */
export const isClockTime = (value: string): boolean => CLOCK.test(value);
