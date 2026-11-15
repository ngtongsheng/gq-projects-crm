"use client";

import { Settings } from "lucide-react";
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
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { setNextDoNumber } from "./do-actions";

/**
 * Sets the next DO running no. once, to continue from the last manual DO. After that the app
 * counts up by itself. For the MD, Purchasing and HR & Accounts.
 */
export function DoNumberingDialog({
  nextNo,
  triggerLabel = "Settings",
}: {
  nextNo: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await setNextDoNumber(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Next DO no. saved.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Next DO running number</DialogTitle>
          <DialogDescription>
            Use this once, to continue from your last manual DO. After that the
            app counts up by itself.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nextNo">
                Next running no. (4 digits)
              </FieldLabel>
              <Input
                id="nextNo"
                name="nextNo"
                className="font-mono"
                inputMode="numeric"
                maxLength={4}
                defaultValue={nextNo}
                required
              />
              <FieldDescription>
                Must be higher than the last number used or cancelled.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
