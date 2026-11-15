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

type PlanCallDialogProps = {
  /** The day the call is planned for. */
  date: string;
  customers: CustomerOption[];
  /** The calendar address without the call day; closing goes back to it. */
  closeHref: string;
};

const DEFAULT_TIME = "09:00";

/** "Plan a call": the activity form set to a call. Open whenever the address carries a call day. */
export function PlanCallDialog({
  date,
  customers,
  closeHref,
}: PlanCallDialogProps) {
  const router = useRouter();
  const close = () => router.replace(closeHref);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan a call</DialogTitle>
          <DialogDescription>
            On {formatDate(date)}. Times are Malaysia time.
          </DialogDescription>
        </DialogHeader>
        <ActivityForm
          customers={customers}
          defaultType="call"
          defaultStatus="planned"
          defaultStartsAt={`${date}T${DEFAULT_TIME}`}
          onSaved={close}
        />
      </DialogContent>
    </Dialog>
  );
}
