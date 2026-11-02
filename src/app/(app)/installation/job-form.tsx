"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  JOB_TYPE_LABEL,
  JOB_TYPES,
  type JobStatus,
  type JobType,
  TRANSPORTERS,
} from "@/lib/domain/delivery-status";
import { saveJob } from "./actions";

export type JobRow = {
  id: string;
  jobType: JobType;
  status: JobStatus;
  scheduledOn: string;
  endsOn: string;
  /** HH:MM, or empty when no time is set. */
  startTime: string;
  installer: string;
  siteSupervisorId: string;
  notes: string;
  /** Only delivery jobs have a DO. */
  order: {
    runningNo: string;
    transporter: string;
    deliveredOn: string;
    items: string;
    isFinal: boolean;
    signedReturned: boolean;
  } | null;
};

type JobDialogProps = {
  mofId: string;
  mofNo: string;
  job?: JobRow;
  team: { id: string; name: string }[];
  defaultInstaller: string;
  /** What is not yet ticked on the MOF before goods go out; shown for a delivery. */
  missingChecks: string[];
  /** The day to start on when scheduling a new job, e.g. the calendar day clicked. */
  defaultDate?: string;
};

const NONE = "none";

/** Schedules a job for an MOF, or edits one. Reused wherever jobs are scheduled. */
export function JobDialog(props: JobDialogProps) {
  const [open, setOpen] = useState(false);
  const { job } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {job ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Schedule job
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {job
              ? `Edit ${JOB_TYPE_LABEL[job.jobType].toLowerCase()}`
              : "Schedule job"}
          </DialogTitle>
          <DialogDescription>
            Key in the dates and who is going. Deliveries also take the DO from
            Zoho.
          </DialogDescription>
        </DialogHeader>
        <JobForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function JobForm({
  mofId,
  mofNo,
  job,
  team,
  defaultInstaller,
  missingChecks,
  defaultDate,
  onSaved,
}: JobDialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [jobType, setJobType] = useState<JobType>(
    job?.jobType ?? "installation",
  );
  const [startDate, setStartDate] = useState(
    job?.scheduledOn ?? defaultDate ?? "",
  );
  const [endDate, setEndDate] = useState(job?.endsOn ?? defaultDate ?? "");
  const [supervisor, setSupervisor] = useState(job?.siteSupervisorId || NONE);
  const order = job?.order;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveJob(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(job ? "Job saved." : "Job scheduled.");
        onSaved();
      }
    });
  }

  return (
    <form action={save}>
      <input type="hidden" name="mofId" value={mofId} />
      {job && <input type="hidden" name="jobId" value={job.id} />}
      <input type="hidden" name="jobType" value={jobType} />
      <input
        type="hidden"
        name="siteSupervisorId"
        value={supervisor === NONE ? "" : supervisor}
      />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="jobTypeSelect">Job type</FieldLabel>
            <Select
              value={jobType}
              onValueChange={(value) => setJobType(value as JobType)}
              disabled={job !== undefined}
            >
              <SelectTrigger id="jobTypeSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {JOB_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {job && (
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select name="status" defaultValue={job.status}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {JOB_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        {jobType === "delivery" && missingChecks.length > 0 && (
          <FieldError>
            Before delivery for {mofNo}: {missingChecks.join(" · ")}. Tick these
            on the MOF first.
          </FieldError>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="scheduledOn">Start date</FieldLabel>
            <Input
              id="scheduledOn"
              name="scheduledOn"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                if (endDate < event.target.value) {
                  setEndDate(event.target.value);
                }
              }}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="endsOn">End date</FieldLabel>
            <Input
              id="endsOn"
              name="endsOn"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="startTime">Time</FieldLabel>
            <Input
              id="startTime"
              name="startTime"
              type="time"
              className="font-mono"
              defaultValue={job?.startTime}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="installer">Installer / crew</FieldLabel>
            <Input
              id="installer"
              name="installer"
              defaultValue={job ? job.installer : defaultInstaller}
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="supervisorSelect">
              Supervisor in charge
            </FieldLabel>
            <Select value={supervisor} onValueChange={setSupervisor}>
              <SelectTrigger id="supervisorSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No supervisor in charge</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {jobType === "delivery" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="runningNo">DO no.</FieldLabel>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{mofNo}</span>
                  <Input
                    id="runningNo"
                    name="runningNo"
                    className="font-mono"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="5563"
                    defaultValue={order?.runningNo}
                  />
                </div>
                <FieldDescription>
                  The 4-digit running no. from Zoho, once the DO is issued.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="transporter">Transporter</FieldLabel>
                <Input
                  id="transporter"
                  name="transporter"
                  list="transporters"
                  defaultValue={order?.transporter}
                  maxLength={100}
                />
                <datalist id="transporters">
                  {TRANSPORTERS.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="items">Items / qty delivered</FieldLabel>
                <Input
                  id="items"
                  name="items"
                  placeholder="e.g. Carpet tile 1,200 m², skirting 300 m"
                  defaultValue={order?.items}
                  maxLength={200}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="deliveredOn">Delivered on</FieldLabel>
                <Input
                  id="deliveredOn"
                  name="deliveredOn"
                  type="date"
                  defaultValue={order?.deliveredOn}
                />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="isFinal"
                name="isFinal"
                defaultChecked={order?.isFinal}
              />
              <FieldLabel htmlFor="isFinal" className="font-normal">
                Final delivery (all items delivered)
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="signedReturned"
                name="signedReturned"
                defaultChecked={order?.signedReturned}
              />
              <FieldLabel htmlFor="signedReturned" className="font-normal">
                DO signed and returned
              </FieldLabel>
            </Field>
          </>
        )}
        <Field>
          <FieldLabel htmlFor="notes">Note</FieldLabel>
          <Input
            id="notes"
            name="notes"
            placeholder="e.g. Night shift, loading bay B1"
            defaultValue={job?.notes}
            maxLength={300}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save job"}
        </Button>
      </FieldGroup>
    </form>
  );
}
