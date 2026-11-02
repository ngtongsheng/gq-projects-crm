"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format/date";
import { JobForm } from "./job-form";

export type MofOption = {
  id: string;
  mofNo: string;
  label: string;
  installer: string;
  missingChecks: string[];
};

type AddJobDialogProps = {
  /** The day clicked on the calendar. */
  date: string;
  mofs: MofOption[];
  team: { id: string; name: string }[];
  /** The calendar address without the add day; closing goes back to it. */
  closeHref: string;
};

/** Open whenever the address carries an add day; pick the MOF, then fill in the job. */
export function AddJobDialog({
  date,
  mofs,
  team,
  closeHref,
}: AddJobDialogProps) {
  const router = useRouter();
  const [mofId, setMofId] = useState("");
  const close = () => router.replace(closeHref);
  const mof = mofs.find((option) => option.id === mofId);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule job</DialogTitle>
          <DialogDescription>
            Starting {formatDate(date)}. Pick the MOF, then key in the details.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="mofSelect">MOF</FieldLabel>
          <Select value={mofId} onValueChange={setMofId}>
            <SelectTrigger id="mofSelect">
              <SelectValue placeholder="Choose the MOF" />
            </SelectTrigger>
            <SelectContent>
              {mofs.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {mof && (
          <JobForm
            key={mof.id}
            mofId={mof.id}
            mofNo={mof.mofNo}
            team={team}
            defaultInstaller={mof.installer}
            missingChecks={mof.missingChecks}
            defaultDate={date}
            onSaved={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
