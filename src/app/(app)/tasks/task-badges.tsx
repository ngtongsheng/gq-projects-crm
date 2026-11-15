import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import {
  TASK_PRIORITY_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain/task-flow";
import { TASK_STATUS_LABEL } from "@/lib/domain/task-labels";
import type { Translate } from "@/lib/i18n/translate";
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

export function PriorityBadge({
  priority,
  t,
}: {
  priority: TaskPriority;
  t: Translate;
}) {
  return (
    <StatusBadge tone={PRIORITY_TONE[priority]}>
      {t(TASK_PRIORITY_LABEL[priority])}
    </StatusBadge>
  );
}

export function TaskStatusBadge({
  status,
  t,
}: {
  status: TaskStatus;
  t: Translate;
}) {
  return (
    <StatusBadge tone={STATUS_TONE[status]}>
      {t(TASK_STATUS_LABEL[status])}
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
