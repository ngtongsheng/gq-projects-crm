import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { JobRoleLabel } from "@/lib/auth/job-role";
import type { WorkloadRow } from "./task-view";

const columns: DataTableColumn<WorkloadRow>[] = [
  {
    key: "person",
    header: "Person",
    cell: ({ person }) => (
      <div>
        <Link
          href={`/tasks?view=all&person=${person.id}`}
          className="font-semibold hover:underline"
        >
          {person.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {JobRoleLabel[person.jobRole]}
        </p>
      </div>
    ),
  },
  { key: "open", header: "Open", numeric: true, cell: (row) => row.open },
  {
    key: "overdue",
    header: "Overdue",
    numeric: true,
    cell: (row) =>
      row.overdue > 0 ? <StatusBadge tone="bad">{row.overdue}</StatusBadge> : 0,
  },
  {
    key: "dueThisWeek",
    header: "Due this week",
    numeric: true,
    cell: (row) => row.dueThisWeek,
  },
  {
    key: "waitingReview",
    header: "Waiting review",
    numeric: true,
    cell: (row) => row.waitingReview,
  },
  {
    key: "doneThisMonth",
    header: "Done this month",
    numeric: true,
    cell: (row) => row.doneThisMonth,
  },
  {
    key: "oldestOverdue",
    header: "Oldest overdue",
    cell: ({ oldestOverdue }) =>
      oldestOverdue ? `${oldestOverdue.title} · ${oldestOverdue.days}d` : "–",
  },
];

export function WorkloadTable({ rows }: { rows: WorkloadRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.person.id}
      empty={<EmptyState title="No tasks yet." />}
    />
  );
}
