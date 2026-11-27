"use client";

import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { InstallerResult } from "../installer-actions";

type FormShellProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  children: (done: () => void) => ReactNode;
};

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function FormDialog({
  trigger,
  title,
  description,
  children,
}: FormShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** Runs a server action from a form, toasting the outcome and closing on success. */
export function useSubmit(
  action: (formData: FormData) => Promise<InstallerResult>,
  savedMessage: string,
  onSaved: () => void,
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await action(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(savedMessage);
        onSaved();
      }
    });
  };
  return { pending, error, submit };
}
