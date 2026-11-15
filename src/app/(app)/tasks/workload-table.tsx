import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { JobRoleLabel } from "@/lib/auth/job-role";
import type { Translate } from "@/lib/i18n/translate";
import type { WorkloadRow } from "./task-view";

const columnsFor = (t: Translate): DataTableColumn<WorkloadRow>[] => [
  {
    key: "person",
    header: t("Person"),
    cell: ({ person }) => (
      <div>
        <Link
          href={`/tasks?view=all&person=${person.id}`}
          className="font-semibold hover:underline"
        >
          {person.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {t(JobRoleLabel[person.jobRole])}
        </p>
      </div>
    ),
  },
  { key: "open", header: t("Open"), numeric: true, cell: (row) => row.open },
  {
    key: "overdue",
    header: t("Overdue"),
    numeric: true,
    cell: (row) =>
      row.overdue > 0 ? <StatusBadge tone="bad">{row.overdue}</StatusBadge> : 0,
  },
  {
    key: "dueThisWeek",
    header: t("Due this week"),
    numeric: true,
    cell: (row) => row.dueThisWeek,
  },
  {
    key: "waitingReview",
    header: t("Waiting review"),
    numeric: true,
    cell: (row) => row.waitingReview,
  },
  {
    key: "doneThisMonth",
    header: t("Done this month"),
    numeric: true,
    cell: (row) => row.doneThisMonth,
  },
  {
    key: "oldestOverdue",
    header: t("Oldest overdue"),
    cell: ({ oldestOverdue }) =>
      oldestOverdue ? `${oldestOverdue.title} · ${oldestOverdue.days}d` : "–",
  },
];

export function WorkloadTable({
  rows,
  t,
}: {
  rows: WorkloadRow[];
  t: Translate;
}) {
  return (
    <DataTable
      columns={columnsFor(t)}
      rows={rows}
      getRowKey={(row) => row.person.id}
      empty={<EmptyState title={t("No tasks yet.")} />}
    />
  );
}
