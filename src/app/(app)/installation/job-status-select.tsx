"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  JOB_STATUS_LABEL,
  JOB_STATUSES,
  type JobStatus,
} from "@/lib/domain/delivery-status";
import { updateJobStatus } from "./actions";

type JobStatusSelectProps = {
  mofId: string;
  jobId: string;
  status: JobStatus;
};

/** Moves a job along without opening the full form; a supervisor does this from the site. */
export function JobStatusSelect({
  mofId,
  jobId,
  status,
}: JobStatusSelectProps) {
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const parsed = JOB_STATUSES.find((value) => value === next);
    if (!parsed || parsed === status) return;
    startTransition(async () => {
      const result = await updateJobStatus(mofId, jobId, parsed);
      if (result.error) toast.error(result.error);
      else toast.success(`Marked ${JOB_STATUS_LABEL[parsed].toLowerCase()}.`);
    });
  }

  return (
    <Select value={status} onValueChange={change} disabled={pending}>
      <SelectTrigger aria-label="Job status" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {JOB_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {JOB_STATUS_LABEL[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
