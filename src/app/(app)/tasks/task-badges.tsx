import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import {
  TASK_PRIORITY_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain/task-flow";
import { TASK_STATUS_LABEL } from "@/lib/domain/task-labels";
import type { DueNote } from "./task-view";

const PRIORITY_TONE: Record<TaskPriority, StatusTone> = {
  low: "neutral",
  normal: "neutral",
  high: "warn",
  urgent: "bad",
};

const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  not_started: "neutral",
  in_progress: "warn",
  pending_review: "info",
  revision_required: "bad",
  completed: "good",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <StatusBadge tone={PRIORITY_TONE[priority]}>
      {TASK_PRIORITY_LABEL[priority]}
    </StatusBadge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <StatusBadge tone={STATUS_TONE[status]}>
      {TASK_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

/** The line under the due date: a badge when it needs a look, plain text otherwise. */
export function DueNoteLine({ note }: { note: DueNote }) {
  if (note.tone === "plain") {
    return <span className="text-xs text-muted-foreground">{note.text}</span>;
  }
  return <StatusBadge tone={note.tone}>{note.text}</StatusBadge>;
}
