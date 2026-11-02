"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { requestOwnership } from "./actions";

type RequestOwnershipDialogProps = {
  contactId: string;
  customerName: string;
  /** Owners' names, so the person knows who the director will ask. */
  ownerNames: string[];
};

// No <form> here: this dialog also opens from inside the add-customer form.
export function RequestOwnershipDialog({
  contactId,
  customerName,
  ownerNames,
}: RequestOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await requestOwnership(contactId, reason);
      setError(result.error);
      if (!result.error) {
        toast.success("Request sent. The director will review it.");
        setOpen(false);
        setReason("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Request ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request ownership of {customerName}</DialogTitle>
          <DialogDescription>
            {ownerNames.length > 0
              ? `Now with ${ownerNames.join(" + ")}. `
              : ""}
            The MD or Sales Director decides. If approved, you become the owner.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="ownershipReason">Reason</FieldLabel>
          <Textarea
            id="ownershipReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why should this customer be yours?"
            maxLength={500}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="button" onClick={send} disabled={pending}>
          {pending ? "Sending..." : "Send request"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
