"use client";

import { useRouter } from "next/navigation";
import {
  ActivityForm,
  type CustomerOption,
} from "@/app/(app)/activities/activity-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format/date";
import type { Colleague } from "./invitee-picker";

type AddActivityDialogProps = {
  /** The day clicked on the calendar. */
  date: string;
  customers: CustomerOption[];
  /** Colleagues the salesperson can invite along. */
  colleagues: Colleague[];
  /** The calendar address without the add day; closing goes back to it. */
  closeHref: string;
};

const DEFAULT_TIME = "09:00";

/** Open whenever the address carries an add day; closing drops it again. */
export function AddActivityDialog({
  date,
  customers,
  colleagues,
  closeHref,
}: AddActivityDialogProps) {
  const router = useRouter();
  const close = () => router.replace(closeHref);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>
            On {formatDate(date)}. Times are Malaysia time.
          </DialogDescription>
        </DialogHeader>
        <ActivityForm
          customers={customers}
          colleagues={colleagues}
          defaultStartsAt={`${date}T${DEFAULT_TIME}`}
          onSaved={close}
        />
      </DialogContent>
    </Dialog>
  );
}
