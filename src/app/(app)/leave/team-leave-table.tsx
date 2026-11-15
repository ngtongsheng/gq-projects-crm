import { CalendarOff } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { defaultEntitlement } from "@/lib/domain/leave-balance";
import { LEAVE_TYPE_SHORT } from "@/lib/domain/leave-labels";
import { formatDate } from "@/lib/format/date";
import { EntitlementSheet } from "./entitlement-sheet";
import {
  entitlementFor,
  type LeaveSetup,
  leaveDates,
  type TeamLeaveRow,
} from "./leave-view";

const NONE = "—";

/** Everyone's entitlement, taken and balance for the year (the demo's Team leave table). */
export function TeamLeaveTable({
  rows,
  editor,
}: {
  rows: TeamLeaveRow[];
  /** Adds the Entitlement button for the year; absent for people who may only read. */
  editor?: { year: number; setup: LeaveSetup };
}) {
  const columns: DataTableColumn<TeamLeaveRow>[] = [
    {
      key: "person",
      header: "Person",
      cell: ({ person }) => (
        <div className="min-w-36">
          <p className="font-semibold">{person.name}</p>
          <p className="text-xs text-muted-foreground">
            {JobRoleLabel[person.jobRole]}
            {person.joinedOn ? ` · joined ${formatDate(person.joinedOn)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "entitled",
      header: "AL entitled",
      numeric: true,
      cell: ({ balance }) => balance?.entitlement.annualDays ?? NONE,
    },
    {
      key: "carried",
      header: "Carried fwd",
      numeric: true,
      cell: ({ balance }) => balance?.entitlement.carriedDays || NONE,
    },
    {
      key: "taken",
      header: "AL taken",
      numeric: true,
      cell: ({ balance }) =>
        balance ? (
          <div>
            <p>{balance.annualTaken}</p>
            {balance.annualPending > 0 && (
              <p className="font-sans text-xs text-muted-foreground">
                +{balance.annualPending} waiting
              </p>
            )}
          </div>
        ) : (
          NONE
        ),
    },
    {
      key: "balance",
      header: "AL balance",
      numeric: true,
      cell: ({ balance }) =>
        balance ? (
          <span
            className={`font-semibold ${balance.annualBalance < 0 ? "text-bad" : ""}`}
          >
            {balance.annualBalance}
          </span>
        ) : (
          NONE
        ),
    },
    {
      key: "mcTaken",
      header: "MC taken",
      numeric: true,
      cell: ({ balance, slipsMissing }) => (
        <div>
          <p>{balance?.mcTaken ?? NONE}</p>
          {slipsMissing > 0 && (
            <p className="font-sans text-xs text-bad">
              {slipsMissing} MC not uploaded
            </p>
          )}
        </div>
      ),
    },
    {
      key: "mcBalance",
      header: "MC balance",
      numeric: true,
      cell: ({ balance }) => balance?.mcBalance ?? NONE,
    },
    {
      key: "next",
      header: "Next leave",
      cell: ({ next }) =>
        next ? (
          <span className="whitespace-nowrap">
            {LEAVE_TYPE_SHORT[next.leaveType]} {leaveDates(next)}
            {next.status === "pending" ? " (waiting)" : ""}
          </span>
        ) : (
          NONE
        ),
    },
  ];
  if (editor) {
    columns.push({
      key: "entitlement",
      header: "",
      cell: ({ person }) => {
        const { entitlement, isOverride } = entitlementFor(
          person,
          editor.year,
          editor.setup,
        );
        return (
          <EntitlementSheet
            personId={person.id}
            personName={person.name}
            year={editor.year}
            current={entitlement}
            companyDefault={defaultEntitlement(
              editor.setup.policy,
              person.joinedOn,
              editor.year,
            )}
            isOverride={isOverride}
          />
        );
      },
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={({ person }) => person.id}
      empty={<EmptyState icon={CalendarOff} title="Nobody to show." />}
    />
  );
}
