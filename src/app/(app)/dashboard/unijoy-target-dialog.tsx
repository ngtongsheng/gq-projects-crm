"use client";

import { Pencil } from "lucide-react";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { saveUnijoyTarget } from "./unijoy-actions";

/** Keys in the Unijoy target for a year, in m². */
export function UnijoyTargetDialog({
  year,
  target,
}: {
  year: number;
  target: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveUnijoyTarget(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Unijoy target saved.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
        >
          <Pencil data-icon="inline-start" />
          {target === null ? "Set target" : "Change target"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unijoy target</DialogTitle>
          <DialogDescription>
            How many m² of Unijoy you want to order in the year. Only product
            lines marked as from Unijoy count towards it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="unijoyYear">Year</FieldLabel>
              <Input
                id="unijoyYear"
                name="year"
                inputMode="numeric"
                defaultValue={String(year)}
                className="font-mono tabular-nums"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="unijoyTarget">Target (m²)</FieldLabel>
              <Input
                id="unijoyTarget"
                name="target"
                inputMode="decimal"
                defaultValue={target === null ? "" : String(target)}
                placeholder="25000"
                className="font-mono tabular-nums"
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save target"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
