import { CalendarX } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/format/date";
import { activityStatusTone } from "../activities/activity-status-tone";
import { toMytInput } from "../activities/activity-time";
import { activityDay } from "../activities/last-activity";
import { needsOutcome } from "../activities/outcome-schema";
import { ActivityStatusLabel, ActivityTypeLabel } from "../activities/schemas";
import type { CalendarActivity } from "./calendar-data";
import { isAwaitingReply } from "./invitation-view";

type MonthlyListProps = {
  activities: readonly CalendarActivity[];
  meId: string;
  nameOf: ReadonlyMap<string, string>;
  /** Adds the salesperson column; for a whole team rather than one diary. */
  showOwner: boolean;
  /** The week view, where an invitation is answered. */
  replyHref: (day: string) => string;
};

/** The Monthly list tab: every appointment of the month as a table row. */
export function MonthlyList({
  activities,
  meId,
  nameOf,
  showOwner,
  replyHref,
}: MonthlyListProps) {
  return (
    <DataTable
      rows={[...activities]}
      getRowKey={(row) => row.id}
      empty={
        <EmptyState
          icon={CalendarX}
          title="No appointments this month"
          description="Use the arrows to look at another month."
        />
      }
      columns={[
        {
          key: "when",
          header: "Date",
          cell: (row) => (
            <div className="flex flex-col whitespace-nowrap">
              <span className="font-mono tabular-nums">
                {formatDate(activityDay(row.starts_at))}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {toMytInput(row.starts_at).slice(11)}
              </span>
            </div>
          ),
        },
        ...(showOwner
          ? [
              {
                key: "owner",
                header: "Salesperson",
                cell: (row: CalendarActivity) =>
                  nameOf.get(row.owner_id) ?? "Unnamed",
              },
            ]
          : []),
        {
          key: "customer",
          header: "Customer",
          cell: (row) => {
            const awaiting = isAwaitingReply(
              row.owner_id,
              row.activity_invitees,
              meId,
            );
            return (
              <div className="flex flex-col">
                <Link
                  href={
                    awaiting
                      ? replyHref(activityDay(row.starts_at))
                      : `/customers/${row.contact_id}`
                  }
                  className="font-medium hover:underline"
                >
                  {row.contacts.companies.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {row.contacts.name}
                </span>
              </div>
            );
          },
        },
        {
          key: "what",
          header: "Type · Purpose",
          className: "max-sm:hidden",
          cell: (row) => (
            <div className="flex flex-col">
              <span>{ActivityTypeLabel[row.type]}</span>
              <span className="text-xs text-muted-foreground">
                {row.purpose}
              </span>
            </div>
          ),
        },
        {
          key: "status",
          header: "Status",
          cell: (row) => {
            if (isAwaitingReply(row.owner_id, row.activity_invitees, meId)) {
              return <StatusBadge tone="warn">Invitation</StatusBadge>;
            }
            const due = needsOutcome({
              status: row.status,
              startsAt: row.starts_at,
            });
            return (
              <StatusBadge tone={due ? "warn" : activityStatusTone[row.status]}>
                {due ? "Log outcome" : ActivityStatusLabel[row.status]}
              </StatusBadge>
            );
          },
        },
        {
          key: "outcome",
          header: "Outcome",
          className: "max-sm:hidden",
          cell: (row) => row.outcome || "–",
        },
      ]}
    />
  );
}
