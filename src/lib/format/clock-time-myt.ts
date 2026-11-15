/** The time of day in Malaysia as "HH:MM", comparable as text with a time input's value. */
export function clockTimeMyt(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
