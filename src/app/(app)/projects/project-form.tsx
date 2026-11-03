"use client";

import { FolderPlus, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { addDays, todayMyt } from "@/lib/format/date";
import { AccountType, AccountTypeLabel } from "../customers/schemas";
import { saveProject } from "./actions";
import {
  LeadSource,
  LeadSourceLabel,
  ProjectStage,
  ProjectStageLabel,
} from "./schemas";

export type EditableProject = {
  id: string;
  name: string;
  leadSource: LeadSource;
  stage: ProjectStage;
  qtySqft: number;
  value: number;
  picId: string;
  supportId: string | null;
  commissionType: AccountType;
  passedBy: string | null;
  nextAction: string;
  nextActionDate: string;
  notes: string;
};

type Person = { id: string; name: string };

type ProjectDialogProps = {
  contactId: string;
  customerName: string;
  team: Person[];
  /** The MD and Sales Director choose the PIC and commission type; everyone else leaves them as they are. */
  canChoosePic: boolean;
  /** The signed-in person, who becomes the PIC of a project they add. */
  me: Person;
  /** The customer's own commission type, which a new project starts on. */
  customerCommission: { type: AccountType; passedBy: string | null };
  /** Present when editing; absent when adding. */
  project?: EditableProject;
};

const NO_SUPPORT = "none";

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function ProjectDialog(props: ProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const editing = props.project !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <FolderPlus data-icon="inline-start" />
            Add project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "Add project"}</DialogTitle>
          <DialogDescription>For {props.customerName}.</DialogDescription>
        </DialogHeader>
        <ProjectForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({
  contactId,
  team,
  canChoosePic,
  me,
  customerCommission,
  project,
  onSaved,
}: ProjectDialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supportId, setSupportId] = useState(project?.supportId ?? NO_SUPPORT);
  const [commissionType, setCommissionType] = useState<AccountType>(
    project?.commissionType ?? customerCommission.type,
  );
  const picId = project?.picId ?? me.id;
  const passedBy = project ? project.passedBy : customerCommission.passedBy;
  const nameOf = (id: string | null) =>
    team.find((member) => member.id === id)?.name ?? "Unnamed";

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveProject(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(project ? "Project saved." : "Project added.");
        onSaved();
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      {project ? (
        <input type="hidden" name="projectId" value={project.id} />
      ) : (
        <input type="hidden" name="contactId" value={contactId} />
      )}
      <input
        type="hidden"
        name="supportId"
        value={supportId === NO_SUPPORT ? "" : supportId}
      />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Project name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Menara Ilham L12 office"
            defaultValue={project?.name}
            maxLength={200}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="stage">Stage</FieldLabel>
            <Select name="stage" defaultValue={project?.stage ?? "lead"}>
              <SelectTrigger id="stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ProjectStage.options.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {ProjectStageLabel[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="leadSource">Lead source</FieldLabel>
            <Select name="leadSource" defaultValue={project?.leadSource}>
              <SelectTrigger id="leadSource">
                <SelectValue placeholder="Choose a source" />
              </SelectTrigger>
              <SelectContent>
                {LeadSource.options.map((source) => (
                  <SelectItem key={source} value={source}>
                    {LeadSourceLabel[source]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="value">Value (RM)</FieldLabel>
            <Input
              id="value"
              name="value"
              inputMode="decimal"
              className="font-mono tabular-nums"
              placeholder="0.00"
              defaultValue={project ? String(project.value) : ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="qtySqft">Quantity (sq ft)</FieldLabel>
            <Input
              id="qtySqft"
              name="qtySqft"
              inputMode="decimal"
              className="font-mono tabular-nums"
              placeholder="0"
              defaultValue={project ? String(project.qtySqft) : ""}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="picId">Person in charge</FieldLabel>
            {canChoosePic ? (
              <Select name="picId" defaultValue={picId}>
                <SelectTrigger id="picId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="picId" value={nameOf(picId)} disabled />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="supportPicker">Supporting</FieldLabel>
            <Select value={supportId} onValueChange={setSupportId}>
              <SelectTrigger id="supportPicker">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPPORT}>None</SelectItem>
                {team
                  .filter((member) => member.id !== picId)
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {canChoosePic ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="commissionType">Commission type</FieldLabel>
              <Select
                name="commissionType"
                value={commissionType}
                onValueChange={(value) =>
                  setCommissionType(AccountType.parse(value))
                }
              >
                <SelectTrigger id="commissionType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AccountType.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {AccountTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {commissionType === "pass_down" && (
              <Field>
                <FieldLabel htmlFor="passedBy">Passed down by</FieldLabel>
                <Select name="passedBy" defaultValue={passedBy ?? undefined}>
                  <SelectTrigger id="passedBy">
                    <SelectValue placeholder="Choose a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
        ) : (
          <Field>
            <FieldLabel htmlFor="commissionShown">Commission type</FieldLabel>
            <Input
              id="commissionShown"
              value={AccountTypeLabel[commissionType]}
              disabled
            />
            <FieldDescription>
              Set by the MD or Sales Director.
            </FieldDescription>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="nextAction">Next action</FieldLabel>
            <Input
              id="nextAction"
              name="nextAction"
              placeholder="e.g. Send catalogue"
              defaultValue={project?.nextAction}
              maxLength={300}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="nextActionDate">By date</FieldLabel>
            <Input
              id="nextActionDate"
              name="nextActionDate"
              type="date"
              defaultValue={
                project ? project.nextActionDate : addDays(todayMyt(), 3)
              }
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={project?.notes}
            maxLength={2000}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save project"}
        </Button>
      </FieldGroup>
    </form>
  );
}
