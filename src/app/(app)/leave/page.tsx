import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { isManager } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { weekKindFor } from "@/lib/domain/workdays";
import { todayMyt } from "@/lib/format/date";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { ApplyLeaveDialog } from "./apply-leave-dialog";
import { loadLeavePeople, loadLeaveRows, loadLeaveSetup } from "./leave-data";
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

export default async function LeavePage() {
  const me = await requirePage("leave");
  const viewer = { id: me.id, jobRole: me.jobRole };
  const today = todayMyt();
  const year = Number(today.slice(0, 4));

  const team = await getTeamDirectory();
  const names = new Map(team.map((member) => [member.id, member.name]));
  const nameOf = (personId: string) => names.get(personId) ?? "Unnamed";

  const [rows, setup, people, calendar] = await Promise.all([
    loadLeaveRows(),
    loadLeaveSetup(),
    loadLeavePeople(nameOf),
    loadWorkCalendar(weekKindFor(me.jobRole)),
  ]);

  const mine = people.find((person) => person.id === me.id) ?? {
    id: me.id,
    joinedOn: null,
    reportsTo: null,
  };
  const approvers = approverLine(
    { jobRole: me.jobRole, teamLeadId: mine.reportsTo },
    nameOf,
  );
  const balance = balanceFor(rows, mine, year, setup);
  const waiting = waitingForMe(rows, viewer);
  const mineThisYear = myLeave(rows, me.id, year);
  const peopleById = new Map(people.map((person) => [person.id, person]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leave"
        description={`Apply for leave here. ${approvers} approves; HR & Accounts sees every record. Sick? Choose Medical leave (MC) and upload a photo of the MC.`}
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
        <LeaveSection title="Waiting for your approval" note={waiting.length}>
          <WaitingLeaveTable
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
      <LeaveTiles balance={balance} approvers={approvers} />
      <LeaveSection
        title={`My leave ${year}`}
        note={`${mineThisYear.length} application${mineThisYear.length === 1 ? "" : "s"}`}
      >
        <MyLeaveTable
          rows={mineThisYear}
          viewer={viewer}
          today={today}
          nameOf={nameOf}
        />
      </LeaveSection>
      {isManager(me.jobRole) && (
        <LeaveSection
          title={`Team leave ${year}`}
          note={`Company default ${setup.policy.annualDays} AL · ${setup.policy.mcDays} MC a year. Days are working days: Mon-Fri, Mon-Sat for site supervisors; public holidays not counted.`}
        >
          <TeamLeaveTable
            rows={teamLeaveRows(people, rows, year, setup, today)}
          />
        </LeaveSection>
      )}
    </div>
  );
}
