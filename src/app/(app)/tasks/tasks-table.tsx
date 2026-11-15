import { ListChecks, Paperclip } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { TASK_CATEGORY_LABEL } from "@/lib/domain/task-labels";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { DueNoteLine, PriorityBadge, TaskStatusBadge } from "./task-badges";
import { dueNote, type TaskRow } from "./task-view";

/** The demo's task list: Assigned to is left out on My tasks, By on Assigned by me. */
export function TasksTable({
  rows,
  nameOf,
  today,
  showAssignee,
  showAssigner,
  hrefFor,
}: {
  rows: TaskRow[];
  nameOf: (personId: string) => string;
  today: CalendarDate;
  showAssignee: boolean;
  showAssigner: boolean;
  /** The address that opens a task's sheet. */
  hrefFor: (taskId: string) => string;
}) {
  const columns: DataTableColumn<TaskRow>[] = [
    {
      key: "task",
      header: "Task",
      cell: (task) => (
        <div className="min-w-48">
          <Link
            href={hrefFor(task.id)}
            scroll={false}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {task.title}
          </Link>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{TASK_CATEGORY_LABEL[task.category]}</span>
            {task.projectLabel && <span>· {task.projectLabel}</span>}
            {task.fileCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                · <Paperclip className="size-3" aria-hidden />
                <span className="font-mono tabular-nums">{task.fileCount}</span>
                <span className="sr-only">files</span>
              </span>
            )}
          </p>
        </div>
      ),
    },
    ...(showAssignee
      ? [
          {
            key: "assignee",
            header: "Assigned to",
            cell: (task: TaskRow) => (
              <div>
                <p>{nameOf(task.assigneeId)}</p>
                {task.coAssigneeIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    with {task.coAssigneeIds.map(nameOf).join(", ")}
                  </p>
                )}
              </div>
            ),
          },
        ]
      : []),
    ...(showAssigner
      ? [
          {
            key: "assigner",
            header: "By",
            cell: (task: TaskRow) => nameOf(task.assignedBy),
          },
        ]
      : []),
    {
      key: "priority",
      header: "Priority",
      cell: (task) => <PriorityBadge priority={task.priority} />,
    },
    {
      key: "due",
      header: "Due",
      cell: (task) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono whitespace-nowrap tabular-nums">
            {formatDate(task.dueOn)}
          </span>
          <DueNoteLine note={dueNote(task, today)} />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (task) => <TaskStatusBadge status={task.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(task) => task.id}
      empty={<EmptyState icon={ListChecks} title="No tasks." />}
    />
  );
}
