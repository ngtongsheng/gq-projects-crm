"use client";

import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  OT_CLAIM_TYPE_LABEL,
  OT_CLAIM_TYPES,
  type OtClaimType,
} from "@/lib/domain/ot-claim";
import { otHours } from "@/lib/domain/ot-hours";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { isClockTime } from "@/lib/format/clock-time";
import { submitOtClaim } from "./actions";
import type { MofOption } from "./overtime-data";

type OtClaimDialogProps = {
  mofs: MofOption[];
  /** Malaysia date, so the default matches the server. */
  today: string;
};

/** Files overtime or night work: when, which site, why, and how to claim it. */
export function OtClaimDialog({ mofs, today }: OtClaimDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mofId, setMofId] = useState("");
  const [claimAs, setClaimAs] = useState<OtClaimType>("ot");
  const [fromTime, setFromTime] = useState("20:00");
  const [toTime, setToTime] = useState("23:00");

  const hours =
    isClockTime(fromTime) && isClockTime(toTime)
      ? otHours(fromTime, toTime)
      : null;

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await submitOtClaim(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Overtime sent for approval.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          Add overtime
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add overtime</DialogTitle>
          <DialogDescription>
            Night or weekend work. The MD or Sales Director approves it as an OT
            claim or replacement leave, or rejects it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="mofId" value={mofId} />
          <input type="hidden" name="claimAs" value={claimAs} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="otSite">Site</FieldLabel>
              <Select value={mofId} onValueChange={setMofId}>
                <SelectTrigger id="otSite" className="w-full">
                  <SelectValue placeholder="Choose the order" />
                </SelectTrigger>
                <SelectContent>
                  {mofs.map((mof) => (
                    <SelectItem key={mof.id} value={mof.id}>
                      {mof.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="otDate">Date worked</FieldLabel>
              <Input
                id="otDate"
                name="workDate"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="otFrom">From</FieldLabel>
                <Input
                  id="otFrom"
                  name="fromTime"
                  type="time"
                  value={fromTime}
                  onChange={(event) => setFromTime(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="otTo">To</FieldLabel>
                <Input
                  id="otTo"
                  name="toTime"
                  type="time"
                  value={toTime}
                  onChange={(event) => setToTime(event.target.value)}
                  required
                />
              </Field>
            </div>
            <p className="font-mono text-sm tabular-nums" aria-live="polite">
              {hours === null ? "-" : `${hours} hours`}
              <span className="font-sans text-muted-foreground">
                {" "}
                (rounded to the nearest half hour; past midnight counts)
              </span>
            </p>
            <Field>
              <FieldLabel htmlFor="otReason">Reason</FieldLabel>
              <Textarea
                id="otReason"
                name="reason"
                maxLength={300}
                required
                placeholder="e.g. Night shift installation, mall rules"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="otClaimAs">
                I'd like to claim this as
              </FieldLabel>
              <Select
                value={claimAs}
                onValueChange={(value) =>
                  setClaimAs(
                    OT_CLAIM_TYPES.find((type) => type === value) ?? "ot",
                  )
                }
              >
                <SelectTrigger id="otClaimAs" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OT_CLAIM_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {OT_CLAIM_TYPE_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                The approver can choose the other one.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending || mofId === ""}>
              {pending ? "Saving..." : "Send for approval"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
