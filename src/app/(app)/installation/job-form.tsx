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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import {
  inChargeGroups,
  installerIdByName,
  type JobPeople,
  SUPERVISOR_ONLY,
} from "@/lib/domain/job-team";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { saveJob } from "./actions";

export type JobRow = {
  id: string;
  jobType: JobType;
  status: JobStatus;
  scheduledOn: string;
  endsOn: string;
  /** HH:MM, or empty when no time is set. */
  startTime: string;
  /** The installer's name, as written on the job. */
  installer: string;
  installerId: string;
  /** No installer crew: only the supervisor attends. */
  supervisorOnly: boolean;
  /** The person in charge: a site supervisor or a salesperson. */
  siteSupervisorId: string;
  notes: string;
  /** Only delivery jobs have a DO. */
  order: {
    runningNo: string;
    transporter: string;
    deliveredOn: string;
    items: string;
    /** The date printed on the DO; empty means the job's start date. */
    doDate: string;
    isFinal: boolean;
    passedToSupplier: boolean;
    signedReturned: boolean;
  } | null;
};

type JobDialogProps = {
  mofId: string;
  mofNo: string;
  job?: JobRow;
  /** Everyone, for naming a person already on the job. */
  team: { id: string; name: string }[];
  people: JobPeople;
  defaultInstaller: string;
  /** What is not yet ticked on the MOF before goods go out; shown for a delivery. */
  missingChecks: string[];
  /** The day to start on when scheduling a new job, e.g. the calendar day clicked. */
  defaultDate?: string;
  /** Only the MD may correct a DO no. the app already issued. */
  canCorrectDoNo?: boolean;
};

const NONE = "none";

/** Schedules a job for an MOF, or edits one. Reused wherever jobs are scheduled. */
export function JobDialog(props: JobDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { job } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {job ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            {t("Edit")}
          </Button>
        ) : (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            {t("Schedule job")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {job
              ? `${t("Edit")} ${t(JOB_TYPE_LABEL[job.jobType]).toLowerCase()}`
              : t("Schedule job")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Key in the dates and who is going. A delivery also gets its DO no. from here.",
            )}
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
  people,
  defaultInstaller,
  missingChecks,
  defaultDate,
  canCorrectDoNo = false,
  onSaved,
}: JobDialogProps & { onSaved: () => void }) {
  const t = useT();
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
  const [crew, setCrew] = useState(
    job
      ? job.supervisorOnly
        ? SUPERVISOR_ONLY
        : job.installerId || NONE
      : (installerIdByName(people.installers, defaultInstaller) ?? NONE),
  );
  // An installer made inactive since stays pickable on the jobs they already have.
  const crewChoices =
    job?.installerId &&
    !people.installers.some((installer) => installer.id === job.installerId)
      ? [...people.installers, { id: job.installerId, name: job.installer }]
      : people.installers;
  const inCharge = inChargeGroups(
    people,
    team.find((member) => member.id === job?.siteSupervisorId) ?? null,
  );
  const order = job?.order;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveJob(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(job ? t("Job saved.") : t("Job scheduled."));
        onSaved();
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      <input type="hidden" name="mofId" value={mofId} />
      {job && <input type="hidden" name="jobId" value={job.id} />}
      <input type="hidden" name="jobType" value={jobType} />
      <input type="hidden" name="team" value={crew === NONE ? "" : crew} />
      <input
        type="hidden"
        name="siteSupervisorId"
        value={supervisor === NONE ? "" : supervisor}
      />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="jobTypeSelect">{t("Job type")}</FieldLabel>
            <Select
              value={jobType}
              onValueChange={(value) => {
                if (isOneOf(JOB_TYPES, value)) setJobType(value);
              }}
              disabled={job !== undefined}
            >
              <SelectTrigger id="jobTypeSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(JOB_TYPE_LABEL[type])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {job && (
            <Field>
              <FieldLabel htmlFor="status">{t("Status")}</FieldLabel>
              <Select name="status" defaultValue={job.status}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(JOB_STATUS_LABEL[status])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        {jobType === "delivery" && missingChecks.length > 0 && (
          <FieldError>
            {t("Before delivery for")} {mofNo}: {missingChecks.join(" · ")}
            {t(". Tick these on the MOF first.")}
          </FieldError>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="scheduledOn">{t("Start date")}</FieldLabel>
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
            <FieldLabel htmlFor="endsOn">{t("End date")}</FieldLabel>
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
            <FieldLabel htmlFor="startTime">{t("Time")}</FieldLabel>
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
            <FieldLabel htmlFor="crewSelect">{t("Team")}</FieldLabel>
            <Select value={crew} onValueChange={setCrew}>
              <SelectTrigger id="crewSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("Not decided yet")}</SelectItem>
                {crewChoices.map((installer) => (
                  <SelectItem key={installer.id} value={installer.id}>
                    {installer.name}
                  </SelectItem>
                ))}
                <SelectItem value={SUPERVISOR_ONLY}>
                  {t("Supervisor only")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="supervisorSelect">
              {t("Supervisor in charge")}
            </FieldLabel>
            <Select value={supervisor} onValueChange={setSupervisor}>
              <SelectTrigger id="supervisorSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("No one in charge")}</SelectItem>
                <PersonGroup
                  label={t("Site supervisors")}
                  people={inCharge.supervisors}
                />
                <PersonGroup
                  label={t("Salesperson in charge")}
                  people={inCharge.salespeople}
                />
                <PersonGroup label={t("Others")} people={inCharge.others} />
              </SelectContent>
            </Select>
          </Field>
        </div>
        {jobType === "delivery" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel
                  htmlFor={order?.runningNo ? "runningNo" : "issueNo"}
                >
                  {t("DO no.")}
                </FieldLabel>
                {order?.runningNo ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium whitespace-nowrap">
                        {mofNo}
                        {order.runningNo}
                      </span>
                      {canCorrectDoNo && (
                        <Input
                          id="runningNo"
                          name="runningNo"
                          className="w-20 font-mono"
                          inputMode="numeric"
                          maxLength={4}
                          defaultValue={order.runningNo}
                          aria-label={t("Correct the running no.")}
                        />
                      )}
                    </div>
                    <FieldDescription>
                      {canCorrectDoNo
                        ? t("Only you can correct the running no.")
                        : t("Locked. Ask the MD to correct it.")}
                    </FieldDescription>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="issueNo"
                        name="issueNo"
                        defaultChecked={!job}
                      />
                      <FieldLabel htmlFor="issueNo" className="font-normal">
                        {t("Issue DO no. now")}
                      </FieldLabel>
                    </div>
                    <FieldDescription>
                      {t("The next running no. is added after")} {mofNo}{" "}
                      {t(
                        "when you save, so two people never get the same number.",
                      )}
                    </FieldDescription>
                  </>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="transporter">
                  {t("Transporter")}
                </FieldLabel>
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
                <FieldLabel htmlFor="doDate">{t("DO date")}</FieldLabel>
                <Input
                  id="doDate"
                  name="doDate"
                  type="date"
                  defaultValue={order?.doDate}
                />
                <FieldDescription>
                  {t("Left empty, the job's start date is printed.")}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="deliveredOn">
                  {t("Delivered on")}
                </FieldLabel>
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
                {t("Final delivery (all items delivered)")}
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="passedToSupplier"
                name="passedToSupplier"
                defaultChecked={order?.passedToSupplier}
              />
              <FieldLabel htmlFor="passedToSupplier" className="font-normal">
                {t(
                  "DO passed to supplier (supplier delivers straight to site)",
                )}
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="signedReturned"
                name="signedReturned"
                defaultChecked={order?.signedReturned}
              />
              <FieldLabel htmlFor="signedReturned" className="font-normal">
                {t("DO signed and returned")}
              </FieldLabel>
            </Field>
            <p className="text-sm text-muted-foreground">
              {t(
                "Items on the DO are added with DO items on the MOF, once the delivery is saved.",
              )}
            </p>
          </>
        )}
        <Field>
          <FieldLabel htmlFor="notes">{t("Remarks")}</FieldLabel>
          <Input
            id="notes"
            name="notes"
            placeholder={t("e.g. Night shift, loading bay B1")}
            defaultValue={job?.notes}
            maxLength={300}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving...") : t("Save job")}
        </Button>
      </FieldGroup>
    </form>
  );
}

function PersonGroup({
  label,
  people,
}: {
  label: string;
  people: { id: string; name: string }[];
}) {
  if (people.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {people.map((person) => (
        <SelectItem key={person.id} value={person.id}>
          {person.name}
        </SelectItem>
      ))}
    </SelectGroup>
  );
}
