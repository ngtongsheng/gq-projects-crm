import type { JobRole } from "@/lib/auth/job-role";
import { addDays, type CalendarDate } from "@/lib/format/date";
import type { LeaveStatus, LeaveType } from "./leave-balance";
import { isWorkday, weekKindFor } from "./workdays";

type AwayRequest = {
  personId: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  startsOn: CalendarDate;
  endsOn: CalendarDate;
  halfDay: "am" | "pm" | null;
};

export type AwayEntry = {
  personId: string;
  leaveType: LeaveType;
  halfDay: "am" | "pm" | null;
};

/**
 * Who is on approved leave on each day from `from` to `to`. A person only counts on their own
 * working days, so a Site Supervisor is away on a Saturday and everyone else is not
 * (demo onLeave). Days nobody is away are left out.
 */
export function awayByDay(
  requests: readonly AwayRequest[],
  jobRoleOf: (personId: string) => JobRole | undefined,
  holidays: ReadonlySet<CalendarDate>,
  from: CalendarDate,
  to: CalendarDate,
): Map<CalendarDate, AwayEntry[]> {
  const byDay = new Map<CalendarDate, AwayEntry[]>();
  for (const request of requests) {
    const jobRole = jobRoleOf(request.personId);
    if (request.status !== "approved" || !jobRole) continue;
    const calendar = { week: weekKindFor(jobRole), holidays };
    const first = request.startsOn > from ? request.startsOn : from;
    const last = request.endsOn < to ? request.endsOn : to;
    for (let day = first; day <= last; day = addDays(day, 1)) {
      if (!isWorkday(day, calendar)) continue;
      byDay.set(day, [
        ...(byDay.get(day) ?? []),
        {
          personId: request.personId,
          leaveType: request.leaveType,
          halfDay: request.halfDay,
        },
      ]);
    }
  }
  return byDay;
}
