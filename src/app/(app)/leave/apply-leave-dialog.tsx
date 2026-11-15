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
import { needsSlip } from "@/lib/domain/leave-approval";
import {
  LEAVE_TYPES,
  type LeaveBalance,
  type LeaveType,
  leaveDays,
} from "@/lib/domain/leave-balance";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import type { WeekKind } from "@/lib/domain/workdays";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { addDays } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { ATTACHMENT_TYPES } from "@/lib/storage/attachment-rules";
import { prepareAttachment } from "@/lib/storage/downscale";
import { applyForLeave } from "./actions";
import { uploadLeaveSlip } from "./leave-upload";
import { balanceAfter } from "./leave-view";

type HalfDay = "full" | "am" | "pm";

const HALF_DAY_LABEL: Record<HalfDay, string> = {
  full: "Full day",
  am: "Half day · morning",
  pm: "Half day · afternoon",
};

/** The demo's Apply leave sheet: the working days and the balance left are worked out as you pick dates. */
export function ApplyLeaveDialog({
  today,
  week,
  holidays,
  approvers,
  available,
  availableYear,
  onClose,
}: {
  /** Set when another control opens the sheet: it starts open, has no button of its own, and calls this on close. */
  onClose?: () => void;
  today: string;
  /** The applicant's working week, for counting days. */
  week: WeekKind;
  /** Public holidays, left out of the day count. */
  holidays: string[];
  /** Who approves, e.g. "Sales Director or Managing Director". */
  approvers: string;
  /** The balance with what is already waiting approval taken off; null before balances start. */
  available: LeaveBalance | null;
  /** The year `available` is for. */
  availableYear: number;
}) {
  const t = useT();
  const tomorrow = addDays(today, 1);
  const [open, setOpenState] = useState(onClose !== undefined);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next) onClose?.();
  };
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startsOn, setStartsOn] = useState(tomorrow);
  const [endsOn, setEndsOn] = useState(tomorrow);
  const [halfDay, setHalfDay] = useState<HalfDay>("full");
  const [slip, setSlip] = useState<File | null>(null);
  const [slipKey, setSlipKey] = useState(0);

  const half: HalfDay = startsOn === endsOn ? halfDay : "full";
  const days =
    startsOn && endsOn && endsOn >= startsOn
      ? leaveDays(startsOn, endsOn, half !== "full", {
          week,
          holidays: new Set(holidays),
        })
      : 0;
  const after =
    Number(startsOn.slice(0, 4)) === availableYear
      ? balanceAfter(leaveType, days, available)
      : null;

  function changeType(next: LeaveType) {
    setLeaveType(next);
    // An MC is usually applied on the day or after you are back (demo).
    if (next === "mc" && startsOn > today) {
      setStartsOn(today);
      setEndsOn(today);
    }
    if (!needsSlip(next)) setSlip(null);
  }

  async function pickSlip(file: File | undefined) {
    if (!file) return;
    const prepared = await prepareAttachment(file);
    if (prepared.ok) {
      setSlip(prepared.file);
      setError(null);
    } else {
      setSlip(null);
      setSlipKey((key) => key + 1);
      setError(prepared.error);
    }
  }

  function reset() {
    setLeaveType("annual");
    setStartsOn(tomorrow);
    setEndsOn(tomorrow);
    setHalfDay("full");
    setSlip(null);
    setSlipKey((key) => key + 1);
  }

  function save(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await applyForLeave(formData);
      setError(result.error);
      if (result.error !== null) return;
      if (slip) {
        const sent = await uploadLeaveSlip(result.id, slip);
        if (!sent.ok) {
          toast.error(
            `${t("Leave sent, but the MC was not uploaded:")} ${sent.error} ${t("Add it from your leave list.")}`,
          );
        } else {
          toast.success(`${t("Sent to")} ${approvers} ${t("for approval.")}`);
        }
      } else {
        toast.success(`${t("Sent to")} ${approvers} ${t("for approval.")}`);
      }
      form.reset();
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {onClose === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" />
            {t("Apply leave")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Apply leave")}</DialogTitle>
          <DialogDescription>
            {needsSlip(leaveType)
              ? `${t("A medical slip can be added when you apply or later.")} ${approvers} ${t("checks it.")}`
              : `${t("Goes to")} ${approvers} ${t("for approval.")}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="leaveType" value={leaveType} />
          <input
            type="hidden"
            name="halfDay"
            value={half === "full" ? "" : half}
          />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="leaveType">{t("Type")}</FieldLabel>
              <Select
                value={leaveType}
                onValueChange={(value) => changeType(value as LeaveType)}
              >
                <SelectTrigger id="leaveType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(LEAVE_TYPE_LABEL[type])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="leaveStartsOn">{t("From")}</FieldLabel>
                <Input
                  id="leaveStartsOn"
                  name="startsOn"
                  type="date"
                  value={startsOn}
                  onChange={(event) => {
                    setStartsOn(event.target.value);
                    if (endsOn < event.target.value) {
                      setEndsOn(event.target.value);
                    }
                  }}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="leaveEndsOn">
                  {t("To (last day)")}
                </FieldLabel>
                <Input
                  id="leaveEndsOn"
                  name="endsOn"
                  type="date"
                  value={endsOn}
                  min={startsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="leaveHalfDay">{t("Half day?")}</FieldLabel>
              <Select
                value={half}
                disabled={startsOn !== endsOn}
                onValueChange={(value) => setHalfDay(value as HalfDay)}
              >
                <SelectTrigger id="leaveHalfDay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(HALF_DAY_LABEL) as HalfDay[]).map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(HALF_DAY_LABEL[option])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("One day only.")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="leaveReason">{t("Reason")}</FieldLabel>
              <Input
                id="leaveReason"
                name="reason"
                maxLength={500}
                placeholder={t("e.g. Family trip")}
              />
            </Field>
            {needsSlip(leaveType) && (
              <Field className="rounded-lg border border-dashed p-3">
                <FieldLabel htmlFor="leaveSlip">
                  {t("Upload the MC")}
                </FieldLabel>
                <Input
                  key={slipKey}
                  id="leaveSlip"
                  type="file"
                  accept={ATTACHMENT_TYPES.join(",")}
                  onChange={(event) => void pickSlip(event.target.files?.[0])}
                />
                <FieldDescription>
                  {t(
                    "Photo or PDF, up to 1.5 MB. On the phone you can take a photo straight away. You can apply first and upload it later from your leave list.",
                  )}
                </FieldDescription>
              </Field>
            )}
            <p className="text-sm" aria-live="polite">
              <b className="font-mono tabular-nums">{days}</b>{" "}
              {t(days === 1 ? "working day" : "working days")}
              {after !== null && (
                <>
                  {" · "}
                  {t(leaveType === "mc" ? "MC" : "annual leave")}{" "}
                  {t("balance after:")}{" "}
                  <b
                    className={`font-mono tabular-nums ${after < 0 ? "text-bad" : ""}`}
                  >
                    {after}
                  </b>
                </>
              )}
            </p>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Sending...") : t("Submit")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
