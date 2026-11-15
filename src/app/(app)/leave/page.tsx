import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { canEditLeaveSetup, isManager } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { endOfMonth } from "@/lib/domain/calendar-grid";
import { awayByDay } from "@/lib/domain/leave-away";
import { FIRST_LEAVE_YEAR } from "@/lib/domain/leave-balance";
import { weekKindFor } from "@/lib/domain/workdays";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { ApplyLeaveDialog } from "./apply-leave-dialog";
import { AwaySection } from "./away-section";
import { HolidaysSection } from "./holidays-section";
import {
  loadHolidays,
  loadLeavePeople,
  loadLeaveRows,
  loadLeaveSetup,
} from "./leave-data";
import { awayEvents, parseMonthParam } from "./leave-month";
import { LeaveSection } from "./leave-section";
import { LeaveTiles } from "./leave-tiles";
import {
  approverLine,
  balanceFor,
  myLeave,
  teamLeaveRows,
  waitingForMe,
} from "./leave-view";
import { MyLeaveTable } from "./my-leave-table";
import { TeamLeaveTable } from "./team-leave-table";
import { WaitingLeaveTable } from "./waiting-leave-table";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("leave");
  const t = await getT(me.language);
  const viewer = { id: me.id, jobRole: me.jobRole };
  const today = todayMyt();
  const year = Number(today.slice(0, 4));
  const month = parseMonthParam((await searchParams).month, today);
  const manager = isManager(me.jobRole);

  const team = await getTeamDirectory();
  const names = new Map(team.map((member) => [member.id, member.name]));
  const nameOf = (personId: string) => names.get(personId) ?? t("Unnamed");

  const [rows, setup, people, calendar, holidays] = await Promise.all([
    loadLeaveRows(),
    loadLeaveSetup(),
    loadLeavePeople(nameOf),
    loadWorkCalendar(weekKindFor(me.jobRole)),
    manager ? loadHolidays() : [],
  ]);

  const mine = people.find((person) => person.id === me.id) ?? {
    id: me.id,
    joinedOn: null,
    reportsTo: null,
  };
  const approvers = approverLine(
    { jobRole: me.jobRole, teamLeadId: mine.reportsTo },
    nameOf,
    t,
  );
  const balance = balanceFor(rows, mine, year, setup);
  const waiting = waitingForMe(rows, viewer);
  const mineThisYear = myLeave(rows, me.id, year);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const canEdit = canEditLeaveSetup(me.jobRole);
  const away = awayByDay(
    rows,
    (personId) => peopleById.get(personId)?.jobRole,
    new Set(holidays.map((holiday) => holiday.day)),
    month,
    endOfMonth(month),
  );
  const monthEvents = awayEvents(
    away,
    new Map(
      holidays
        .filter((holiday) => holiday.day.startsWith(month.slice(0, 7)))
        .map((holiday) => [holiday.day, holiday.name]),
    ),
    nameOf,
    `/leave?month=${month.slice(0, 7)}`,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Leave")}
        description={`${t("Apply for leave here.")} ${approvers} ${t("approves; HR & Accounts sees every record. Sick? Choose Medical leave (MC) and upload a photo of the MC.")}`}
        actions={
          <ApplyLeaveDialog
            today={today}
            week={calendar.week}
            holidays={[...calendar.holidays]}
            approvers={approvers}
            available={
              balance && {
                ...balance,
                annualBalance: balance.annualBalance - balance.annualPending,
                mcBalance: balance.mcBalance - balance.mcPending,
              }
            }
            availableYear={year}
          />
        }
      />
      {waiting.length > 0 && (
        <LeaveSection
          title={t("Waiting for your approval")}
          note={waiting.length}
        >
          <WaitingLeaveTable
            t={t}
            rows={waiting}
            allRows={rows}
            viewer={viewer}
            nameOf={nameOf}
            balanceOf={(row) => {
              const applicant = peopleById.get(row.personId);
              return applicant
                ? balanceFor(
                    rows,
                    applicant,
                    Number(row.startsOn.slice(0, 4)),
                    setup,
                  )
                : null;
            }}
          />
        </LeaveSection>
      )}
      <LeaveTiles balance={balance} approvers={approvers} t={t} />
      <LeaveSection
        title={`${t("My leave")} ${year}`}
        note={`${mineThisYear.length} ${t(mineThisYear.length === 1 ? "application" : "applications")}`}
      >
        <MyLeaveTable
          t={t}
          rows={mineThisYear}
          viewer={viewer}
          today={today}
          nameOf={nameOf}
        />
      </LeaveSection>
      {manager && (
        <>
          <LeaveSection
            title={`${t("Team leave")} ${year}`}
            note={`${t("Company default")} ${setup.policy.annualDays} AL · ${setup.policy.mcDays} MC ${t("a year.")} ${t("Days are working days: Mon-Fri, Mon-Sat for site supervisors; public holidays not counted.")}`}
          >
            <TeamLeaveTable
              t={t}
              rows={teamLeaveRows(people, rows, year, setup, today)}
              editor={
                // Accounts enters next year's carry-forward in December, so the sheet never opens before 2027.
                canEdit
                  ? { year: Math.max(year, FIRST_LEAVE_YEAR), setup }
                  : undefined
              }
            />
          </LeaveSection>
          <AwaySection
            t={t}
            month={month}
            today={today}
            eventsByDay={monthEvents}
          />
          <HolidaysSection
            t={t}
            holidays={holidays}
            year={Number(month.slice(0, 4))}
            today={today}
            canEdit={canEdit}
          />
        </>
      )}
    </div>
  );
}
