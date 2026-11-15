"use client";

import { Check, Clock, Plus } from "lucide-react";
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
import { SNOOZE_DAYS, type SnoozeDays } from "@/lib/domain/follow-up-snooze";
import {
  FOLLOW_UP_OWNER_LABEL,
  FOLLOW_UP_OWNERS,
  type FollowUpOwner,
} from "@/lib/domain/site-log";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { addFollowUp, setFollowUpDone } from "./actions";
import { snoozeFollowUp } from "./follow-up-actions";

const NOBODY = "nobody";

/** Adds an action to a visit, with who owns it and when it is due. */
export function FollowUpDialog({
  mofId,
  siteLogId,
  people,
}: {
  mofId: string;
  siteLogId: string;
  /** Who a follow-up can be assigned to, besides its owning group. */
  people: readonly { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<FollowUpOwner>("salesperson");
  const [assignee, setAssignee] = useState(NOBODY);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await addFollowUp(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Follow-up added.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus data-icon="inline-start" />
          Add follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a follow-up</DialogTitle>
          <DialogDescription>
            Whoever owns it, or a manager, ticks it off when it is done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="mofId" value={mofId} />
          <input type="hidden" name="siteLogId" value={siteLogId} />
          <input type="hidden" name="ownerGroup" value={owner} />
          <input
            type="hidden"
            name="assigneeId"
            value={assignee === NOBODY ? "" : assignee}
          />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`action-${siteLogId}`}>Action</FieldLabel>
              <Input
                id={`action-${siteLogId}`}
                name="action"
                maxLength={300}
                placeholder="e.g. Order 2 more rolls"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`owner-${siteLogId}`}>Owner</FieldLabel>
                <Select
                  value={owner}
                  onValueChange={(value) => {
                    if (isOneOf(FOLLOW_UP_OWNERS, value)) setOwner(value);
                  }}
                >
                  <SelectTrigger id={`owner-${siteLogId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_OWNERS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {FOLLOW_UP_OWNER_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`due-${siteLogId}`}>
                  Due (optional)
                </FieldLabel>
                <Input id={`due-${siteLogId}`} name="dueOn" type="date" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`assignee-${siteLogId}`}>
                Assigned to (optional)
              </FieldLabel>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger id={`assignee-${siteLogId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>Whoever owns it</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Add follow-up"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Which follow-up a control acts on; `mofId` is null for a visit with no MOF yet. */
type FollowUpTarget = {
  mofId: string | null;
  followUpId: string;
  ownerGroup: FollowUpOwner;
  assigneeId: string | null;
};

type FollowUpCheckProps = FollowUpTarget & {
  done: boolean;
  label: string;
  /** Whether this person's job role may close this follow-up. */
  canClose: boolean;
};

/** The done flag. Disabled for people who may not close it; the database refuses them too. */
export function FollowUpCheck({
  mofId,
  followUpId,
  ownerGroup,
  assigneeId,
  done,
  label,
  canClose,
}: FollowUpCheckProps) {
  const [pending, startTransition] = useTransition();

  function change(checked: boolean) {
    startTransition(async () => {
      const result = await setFollowUpDone(
        mofId,
        followUpId,
        ownerGroup,
        checked,
        assigneeId,
      );
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Checkbox
      checked={done}
      disabled={!canClose || pending}
      aria-label={label}
      onCheckedChange={(checked) => change(checked === true)}
    />
  );
}

/** The Done button for a follow-up that is still open. */
export function FollowUpDoneButton(target: FollowUpTarget) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  function done() {
    startTransition(async () => {
      const result = await setFollowUpDone(
        target.mofId,
        target.followUpId,
        target.ownerGroup,
        true,
        target.assigneeId,
      );
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={done}>
      <Check data-icon="inline-start" />
      {t("Done")}
    </Button>
  );
}

const SNOOZE_LABEL: Record<SnoozeDays, string> = {
  1: "1 working day",
  2: "2 working days",
  5: "5 working days",
};

/** "Still waiting": what is being waited for and how long until it is chased again. */
export function StillWaitingDialog(target: FollowUpTarget) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState<SnoozeDays>(1);

  function save() {
    startTransition(async () => {
      const result = await snoozeFollowUp({ ...target, note, days });
      setError(result.error);
      if (result.error === null) {
        toast.success(
          `${t("We will remind you again on")} ${formatDate(result.snoozedUntil)}.`,
        );
        setOpen(false);
        setNote("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Clock data-icon="inline-start" />
          {t("Still waiting")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Still waiting")}</DialogTitle>
          <DialogDescription>
            {t("Say what you are waiting for and when to chase it again.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`wait-note-${target.followUpId}`}>
                {t("What are you waiting for?")}
              </FieldLabel>
              <Input
                id={`wait-note-${target.followUpId}`}
                value={note}
                maxLength={300}
                required
                placeholder={t("e.g. Supplier says stock arrives Thursday")}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("Remind me again in")}</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {SNOOZE_DAYS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={days === value ? "default" : "outline"}
                    aria-pressed={days === value}
                    className="h-auto min-h-10 whitespace-normal"
                    onClick={() => setDays(value)}
                  >
                    {t(SNOOZE_LABEL[value])}
                  </Button>
                ))}
              </div>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
