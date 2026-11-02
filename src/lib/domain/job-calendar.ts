import { addDays, type CalendarDate } from "@/lib/format/date";

type DatedJob = {
  scheduledOn: CalendarDate;
  endsOn: CalendarDate;
  /** HH:MM, or empty when no time is set. */
  startTime: string;
};

/**
 * Each day from `from` to `to` with the jobs running on it. A job that runs over several
 * days appears on every one of them. Within a day, timed jobs come first by time, then
 * the rest in the order given.
 */
export function jobsByDay<T extends DatedJob>(
  jobs: readonly T[],
  from: CalendarDate,
  to: CalendarDate,
): Map<CalendarDate, T[]> {
  const byDay = new Map<CalendarDate, T[]>();
  for (const job of jobs) {
    const first = job.scheduledOn > from ? job.scheduledOn : from;
    const last = job.endsOn < to ? job.endsOn : to;
    for (let day = first; day <= last; day = addDays(day, 1)) {
      byDay.set(day, [...(byDay.get(day) ?? []), job]);
    }
  }
  for (const [day, dayJobs] of byDay) {
    byDay.set(
      day,
      dayJobs.toSorted((a, b) => {
        if (a.startTime === b.startTime) return 0;
        if (a.startTime === "") return 1;
        if (b.startTime === "") return -1;
        return a.startTime.localeCompare(b.startTime);
      }),
    );
  }
  return byDay;
}
