"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TASK_CATEGORY_LABEL } from "@/lib/domain/task-labels";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { DueNoteLine, PriorityBadge, TaskStatusBadge } from "./task-badges";
import type { TaskDetail } from "./task-detail-data";
import { TaskFilesList } from "./task-files-list";
import { TaskLog } from "./task-log";
import { TaskReviewPanel } from "./task-review-panel";
import { dueNote } from "./task-view";
import { TaskWorkPanel } from "./task-work-panel";

/** What this person may do on the task, worked out on the server from the flow rules. */
export type TaskSheetCan = {
  start: boolean;
  submit: boolean;
  review: boolean;
  moveDate: boolean;
  addReference: boolean;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** The demo's task sheet: details, files with versions, the person's own work, the review and the log. */
export function TaskSheet({
  task,
  names,
  today,
  can,
  closeHref,
}: {
  task: TaskDetail;
  /** Name by person id, for everyone the sheet mentions. */
  names: Record<string, string>;
  today: CalendarDate;
  can: TaskSheetCan;
  closeHref: string;
}) {
  const router = useRouter();
  const t = useT();
  const nameOf = (personId: string) => names[personId] ?? t("Unnamed");
  const assignerName = nameOf(task.assignedBy);
  const note = dueNote(task, today, t);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.replace(closeHref, { scroll: false });
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
          <SheetDescription>
            {t(TASK_CATEGORY_LABEL[task.category])}
            {task.projectLabel && ` · ${task.projectLabel}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
            <Row label={t("Assigned to")}>
              {nameOf(task.assigneeId)}
              {task.coAssigneeIds.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({t("main")}) · {t("with")}{" "}
                  {task.coAssigneeIds.map(nameOf).join(", ")}
                </span>
              )}
            </Row>
            <Row label={t("Assigned by")}>
              {assignerName} · {formatDate(task.assignedOn)}
            </Row>
            <Row label={t("Due")}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums">
                  {formatDate(task.dueOn)}
                </span>
                <DueNoteLine note={note} />
              </span>
            </Row>
            <Row label={t("Priority")}>
              <PriorityBadge priority={task.priority} t={t} />
            </Row>
            <Row label={t("Status")}>
              <TaskStatusBadge status={task.status} t={t} />
              {task.revisionCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · {t("sent back")} {task.revisionCount}{" "}
                  {t(task.revisionCount === 1 ? "time" : "times")}
                </span>
              )}
            </Row>
            {task.description && (
              <Row label={t("Details")}>
                <span className="whitespace-pre-wrap">{task.description}</span>
              </Row>
            )}
          </dl>
          <TaskFilesList
            taskId={task.id}
            files={task.files}
            nameOf={nameOf}
            canAddReference={can.addReference}
          />
          {(can.start || can.submit || can.moveDate) && (
            <TaskWorkPanel
              taskId={task.id}
              dueOn={task.dueOn}
              today={today}
              assignerName={assignerName}
              revising={task.status === "revision_required"}
              sharedWith={
                task.coAssigneeIds.length > 0
                  ? [task.assigneeId, ...task.coAssigneeIds].map(nameOf)
                  : []
              }
              can={can}
              closeHref={closeHref}
            />
          )}
          {can.review && (
            <TaskReviewPanel
              taskId={task.id}
              assigneeName={nameOf(task.assigneeId)}
              closeHref={closeHref}
            />
          )}
          <TaskLog taskId={task.id} log={task.log} nameOf={nameOf} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
