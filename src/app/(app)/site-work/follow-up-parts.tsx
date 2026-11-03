"use client";

import { Plus } from "lucide-react";
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
import {
  FOLLOW_UP_OWNER_LABEL,
  FOLLOW_UP_OWNERS,
  type FollowUpOwner,
} from "@/lib/domain/site-log";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { addFollowUp, setFollowUpDone } from "./actions";

/** Adds an action to a visit, with who owns it and when it is due. */
export function FollowUpDialog({
  mofId,
  siteLogId,
}: {
  mofId: string;
  siteLogId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<FollowUpOwner>("salesperson");

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

type FollowUpCheckProps = {
  mofId: string;
  followUpId: string;
  ownerGroup: FollowUpOwner;
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
