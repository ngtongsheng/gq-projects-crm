import { CalendarOff } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { defaultEntitlement } from "@/lib/domain/leave-balance";
import { LEAVE_TYPE_SHORT } from "@/lib/domain/leave-labels";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
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
  t,
}: {
  t: Translate;
  rows: TeamLeaveRow[];
  /** Adds the Entitlement button for the year; absent for people who may only read. */
  editor?: { year: number; setup: LeaveSetup };
}) {
  const columns: DataTableColumn<TeamLeaveRow>[] = [
    {
      key: "person",
      header: t("Person"),
      cell: ({ person }) => (
        <div className="min-w-36">
          <p className="font-semibold">{person.name}</p>
          <p className="text-xs text-muted-foreground">
            {t(JobRoleLabel[person.jobRole])}
            {person.joinedOn
              ? ` · ${t("joined")} ${formatDate(person.joinedOn)}`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "entitled",
      header: t("AL entitled"),
      numeric: true,
      cell: ({ balance }) => balance?.entitlement.annualDays ?? NONE,
    },
    {
      key: "carried",
      header: t("Carried fwd"),
      numeric: true,
      cell: ({ balance }) => balance?.entitlement.carriedDays || NONE,
    },
    {
      key: "taken",
      header: t("AL taken"),
      numeric: true,
      cell: ({ balance }) =>
        balance ? (
          <div>
            <p>{balance.annualTaken}</p>
            {balance.annualPending > 0 && (
              <p className="font-sans text-xs text-muted-foreground">
                +{balance.annualPending} {t("waiting")}
              </p>
            )}
          </div>
        ) : (
          NONE
        ),
    },
    {
      key: "balance",
      header: t("AL balance"),
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
      header: t("MC taken"),
      numeric: true,
      cell: ({ balance, slipsMissing }) => (
        <div>
          <p>{balance?.mcTaken ?? NONE}</p>
          {slipsMissing > 0 && (
            <p className="font-sans text-xs text-bad">
              {slipsMissing} {t("MC not uploaded")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "mcBalance",
      header: t("MC balance"),
      numeric: true,
      cell: ({ balance }) => balance?.mcBalance ?? NONE,
    },
    {
      key: "next",
      header: t("Next leave"),
      cell: ({ next }) =>
        next ? (
          <span className="whitespace-normal">
            {LEAVE_TYPE_SHORT[next.leaveType]} {leaveDates(next)}
            {next.status === "pending" ? ` (${t("waiting")})` : ""}
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
      empty={<EmptyState icon={CalendarOff} title={t("Nobody to show.")} />}
    />
  );
}
