"use client";

import { Building2, CalendarOff, HeartPulse } from "lucide-react";
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
import type { LeaveBalance } from "@/lib/domain/leave-balance";
import {
  SITE_OFF_KIND_LABEL,
  SITE_OFF_KINDS,
  type SiteOffKind,
} from "@/lib/domain/site-log";
import type { WeekKind } from "@/lib/domain/workdays";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { ApplyLeaveDialog } from "../leave/apply-leave-dialog";
import { addSiteOff } from "./away-actions";

export type LeaveSheetProps = {
  today: CalendarDate;
  week: WeekKind;
  holidays: string[];
  approvers: string;
  available: LeaveBalance | null;
  availableYear: number;
};

/**
 * The demo's "Leave / MC / office" sheet. Leave and MC open the Leave module's apply sheet (D2,
 * one balance in one place); office and other days are kept here so the day is not asked for.
 */
export function AwayChooser({
  day,
  leave,
  compact = false,
}: {
  /** The day the person is recording, offered as the first day. */
  day: CalendarDate;
  leave: LeaveSheetProps;
  /** A small button for a missed-day banner instead of the full-width one. */
  compact?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [kind, setKind] = useState<SiteOffKind | null>(null);
  const [startsOn, setStartsOn] = useState(day);
  const [endsOn, setEndsOn] = useState(day);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setKind(null);
      setStartsOn(day);
      setEndsOn(day);
      setError(null);
    }
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await addSiteOff(formData);
      setError(result.error);
      if (result.error) return;
      toast.success(t("Saved."));
      setOpen(false);
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          {compact ? (
            <Button size="sm" variant="outline">
              {formatDate(day)} · {t("Leave / MC / office")}
            </Button>
          ) : (
            <Button variant="outline" className="h-12 w-full text-base">
              <CalendarOff data-icon="inline-start" />
              {t("Leave / MC / office")}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Away from site")}</DialogTitle>
            <DialogDescription>
              {t("No site work to log? Tell us where you were.")}
            </DialogDescription>
          </DialogHeader>
          {kind === null ? (
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-12 justify-start"
                onClick={() => {
                  setOpen(false);
                  setLeaveOpen(true);
                }}
              >
                <HeartPulse data-icon="inline-start" />
                {t("Leave or MC (goes for approval)")}
              </Button>
              {SITE_OFF_KINDS.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  className="h-12 justify-start"
                  onClick={() => setKind(option)}
                >
                  <Building2 data-icon="inline-start" />
                  {t(SITE_OFF_KIND_LABEL[option])}
                </Button>
              ))}
            </div>
          ) : (
            <form onSubmit={submitKeepingValues(save)}>
              <input type="hidden" name="kind" value={kind} />
              <FieldGroup>
                <p className="text-sm font-medium">
                  {t(SITE_OFF_KIND_LABEL[kind])}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="awayStart">{t("From")}</FieldLabel>
                    <Input
                      id="awayStart"
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
                    <FieldLabel htmlFor="awayEnd">{t("To")}</FieldLabel>
                    <Input
                      id="awayEnd"
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
                  <FieldLabel htmlFor="awayNote">{t("Note")}</FieldLabel>
                  <Input id="awayNote" name="note" maxLength={200} />
                </Field>
                {error && <FieldError>{error}</FieldError>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setKind(null)}
                  >
                    {t("Back")}
                  </Button>
                  <Button type="submit" disabled={pending} className="flex-1">
                    {pending ? t("Saving...") : t("Save")}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {leaveOpen && (
        <ApplyLeaveDialog {...leave} onClose={() => setLeaveOpen(false)} />
      )}
    </>
  );
}
