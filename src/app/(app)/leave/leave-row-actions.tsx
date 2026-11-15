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
import { Input } from "@/components/ui/input";
import { approveLeave, cancelLeave, rejectLeave } from "./actions";

export function CancelLeaveButton({ leaveId }: { leaveId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelLeave(leaveId);
          if (result.error) toast.error(result.error);
          else toast.success("Leave cancelled.");
        })
      }
    >
      Cancel
    </Button>
  );
}

/** Reject (with a reason the person sees) and Approve; an MC says "MC checked". */
export function DecisionButtons({
  leaveId,
  personName,
  isMc,
}: {
  leaveId: string;
  personName: string;
  isMc: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = approve
        ? await approveLeave(leaveId, "")
        : await rejectLeave(leaveId, remark);
      if (result.error) {
        if (approve) toast.error(result.error);
        else setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(
        approve
          ? `${isMc ? "MC checked" : "Approved"} · ${personName}.`
          : `Leave rejected · ${personName}.`,
      );
    });
  }

  return (
    <div className="flex gap-1.5">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setError(null);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject leave · {personName}</DialogTitle>
            <DialogDescription>
              The reason is shown to {personName}.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`reject-${leaveId}`}>Reason</FieldLabel>
            <Input
              id={`reject-${leaveId}`}
              value={remark}
              maxLength={500}
              placeholder="e.g. Site handover that week"
              onChange={(event) => setRemark(event.target.value)}
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => decide(false)}
          >
            Reject
          </Button>
        </DialogContent>
      </Dialog>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => decide(true)}
      >
        {isMc ? "MC checked" : "Approve"}
      </Button>
    </div>
  );
}
