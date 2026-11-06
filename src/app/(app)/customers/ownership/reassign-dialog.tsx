"use client";

import { UserRoundCog } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reassignCustomer } from "./reassign-actions";

const NONE = "none";
const WHOLE = "company";
const ONE = "customer";

type ReassignDialogProps = {
  contactId: string;
  customerName: string;
  companyName: string;
  /** How many customers the company has, so the choice says what it covers. */
  companyCustomers: number;
  ownerNames: string[];
  team: { id: string; name: string }[];
};

// No <form> here, like the request dialog: it can open from inside other pages' forms.
export function ReassignDialog({
  contactId,
  customerName,
  companyName,
  companyCustomers,
  ownerNames,
  team,
}: ReassignDialogProps) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState(NONE);
  const [scope, setScope] = useState(companyCustomers > 1 ? WHOLE : ONE);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await reassignCustomer({
        contactId,
        ownerIds: [first, ...(second === NONE ? [] : [second])].filter(Boolean),
        wholeCompany: scope === WHOLE,
        reason,
      });
      setError(result.error);
      if (!result.error) {
        toast.success(
          result.moved === 1
            ? "Customer reassigned."
            : `${result.moved} customers reassigned.`,
        );
        setOpen(false);
        setFirst("");
        setSecond(NONE);
        setReason("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <UserRoundCog data-icon="inline-start" />
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign {customerName}</DialogTitle>
          <DialogDescription>
            {ownerNames.length > 0
              ? `Now with ${ownerNames.join(" + ")}. `
              : "No owner now. "}
            The new owners replace the old ones, and the change is recorded.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="reassignScope">Who moves</FieldLabel>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="reassignScope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {companyCustomers > 1 && (
                <SelectItem value={WHOLE}>
                  All {companyCustomers} customers at {companyName}
                </SelectItem>
              )}
              <SelectItem value={ONE}>Only {customerName}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="reassignFirst">New owner</FieldLabel>
          <Select value={first} onValueChange={setFirst}>
            <SelectTrigger id="reassignFirst">
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
        <Field>
          <FieldLabel htmlFor="reassignSecond">
            Second owner (optional)
          </FieldLabel>
          <Select value={second} onValueChange={setSecond}>
            <SelectTrigger id="reassignSecond">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {team
                .filter((member) => member.id !== first)
                .map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="reassignReason">Reason</FieldLabel>
          <Textarea
            id="reassignReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Salesperson resigned, or not visited for 3 months"
            maxLength={500}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Reassign"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
