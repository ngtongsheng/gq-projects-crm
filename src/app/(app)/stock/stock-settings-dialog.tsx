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
import { saveStockSettings } from "./actions";
import type { StockSettings } from "./stock-settings";

/** How long a hold runs and how early it warns. For the MD and admins. */
export function StockSettingsDialog({ settings }: { settings: StockSettings }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveStockSettings(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Settings saved.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings data-icon="inline-start" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reservation settings</DialogTitle>
          <DialogDescription>
            Apply to holds confirmed or extended from now on.
          </DialogDescription>
        </DialogHeader>
        <form action={save}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="holdDays">Hold (days)</FieldLabel>
              <Input
                id="holdDays"
                name="holdDays"
                type="number"
                min="1"
                max="365"
                step="1"
                defaultValue={settings.holdDays}
                required
              />
              <FieldDescription>
                How long stock is held once confirmed.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="warningDays">Warning (days)</FieldLabel>
              <Input
                id="warningDays"
                name="warningDays"
                type="number"
                min="0"
                max="365"
                step="1"
                defaultValue={settings.warningDays}
                required
              />
              <FieldDescription>
                A hold shows "expiring" this many days before it ends.
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
