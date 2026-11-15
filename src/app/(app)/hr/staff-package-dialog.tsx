"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWANCE_LABEL,
  HOTEL_LEVEL_LABEL,
  HOTEL_LEVELS,
  type HotelLevel,
  monthlyTotal,
  type StaffPackage,
  type StandardPackage,
} from "@/lib/domain/staff-package";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import {
  type AllowanceDraft,
  AllowanceEditor,
  fromDrafts,
  toDrafts,
} from "./allowance-editor";
import { addStaffPackage, saveStaffDetails } from "./package-actions";

export type HistoryEntry = StaffPackage & { addedByName: string };

export type StaffSheet = {
  personId: string;
  name: string;
  positionLabel: string;
  joinedOn: string | null;
  /** Newest first. */
  history: HistoryEntry[];
  currentId: string | null;
  details: {
    confirmedOn: string | null;
    offerLetterLink: string | null;
    note: string;
  };
  /** The usual package for their position, if they have one. */
  standard: { title: string; package: StandardPackage } | null;
  autoHotelLevel: HotelLevel;
  hotelBudget: Record<HotelLevel, number>;
  today: string;
};

const AUTO = "auto";
const REASONS = [
  "Current package",
  "Annual increment",
  "Promotion",
  "Confirmation after probation",
  "Allowance change",
  "Adjustment",
];

/** Opens one person's package: the dated history, and a sheet to add a change. */
export function StaffPackageDialog({
  sheet,
  hasPackage,
}: {
  sheet: StaffSheet;
  hasPackage: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={hasPackage ? "ghost" : "outline"}>
          {hasPackage ? t("Open") : t("Record")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {sheet.name} · {t("package")}
          </DialogTitle>
          <DialogDescription>
            {sheet.positionLabel} · {t("joined")}{" "}
            {sheet.joinedOn ? formatDate(sheet.joinedOn) : "-"}
          </DialogDescription>
        </DialogHeader>
        <PackageHistory sheet={sheet} />
        <PackageForm sheet={sheet} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PackageHistory({ sheet }: { sheet: StaffSheet }) {
  const t = useT();
  if (sheet.history.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t("Package history")}</h3>
      <ul className="divide-y rounded-lg border">
        {sheet.history.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <div className="mr-auto min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums">
                  {formatDate(entry.effectiveOn)}
                </span>
                {entry.effectiveOn > sheet.today ? (
                  <StatusBadge tone="info">{t("upcoming")}</StatusBadge>
                ) : entry.id === sheet.currentId ? (
                  <StatusBadge tone="good">{t("current")}</StatusBadge>
                ) : null}
                {entry.reason}
              </p>
              <p className="text-muted-foreground">
                {[
                  ...entry.allowances.map(
                    (allowance) =>
                      `${t(ALLOWANCE_LABEL[allowance.name])} ${formatRm(allowance.amount)}`,
                  ),
                  `${t("by")} ${entry.addedByName}`,
                ].join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono tabular-nums">{formatRm(entry.basic)}</p>
              <p className="font-mono text-muted-foreground tabular-nums">
                {t("total")} {formatRm(monthlyTotal(entry))}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PackageForm({
  sheet,
  onSaved,
}: {
  sheet: StaffSheet;
  onSaved: () => void;
}) {
  const t = useT();
  const current = sheet.history.find((entry) => entry.id === sheet.currentId);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [allowances, setAllowances] = useState<AllowanceDraft[]>(() =>
    toDrafts(current?.allowances ?? []),
  );
  const [claimCap, setClaimCap] = useState(
    current?.claimCap == null ? "" : String(current.claimCap),
  );
  const [hotelLevel, setHotelLevel] = useState<string>(
    current?.hotelLevel ?? AUTO,
  );
  const [reason, setReason] = useState(current ? "" : REASONS[0]);

  const text = (formData: FormData, key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const detailsOf = (formData: FormData) => ({
    confirmedOn: text(formData, "confirmedOn"),
    offerLetterLink: text(formData, "offerLetterLink"),
    note: text(formData, "note"),
  });

  function applyStandard() {
    if (!sheet.standard) return;
    setAllowances(toDrafts(sheet.standard.package.allowances));
    const cap = sheet.standard.package.claimCap;
    setClaimCap(cap === null ? "" : String(cap));
    if (reason === "" || reason === REASONS[0]) {
      setReason(current ? "Allowance change" : REASONS[0]);
    }
  }

  function finish(result: { error: string | null }, message: string) {
    setError(result.error);
    if (result.error !== null) return;
    toast.success(t(message));
    onSaved();
  }

  function savePackage(formData: FormData) {
    startTransition(async () => {
      finish(
        await addStaffPackage({
          profileId: sheet.personId,
          effectiveOn: text(formData, "effectiveOn"),
          basic: Number(text(formData, "basic")),
          allowances: fromDrafts(allowances),
          claimCap: claimCap.trim() === "" ? null : Number(claimCap),
          hotelLevel: hotelLevel === AUTO ? "" : hotelLevel,
          reason,
          details: detailsOf(formData),
        }),
        "Package saved.",
      );
    });
  }

  function saveDetails() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      finish(
        await saveStaffDetails({
          profileId: sheet.personId,
          details: detailsOf(formData),
        }),
        "Details saved.",
      );
    });
  }

  const standardCap = sheet.standard?.package.claimCap;
  return (
    <form
      ref={formRef}
      onSubmit={submitKeepingValues((formData) => savePackage(formData))}
    >
      <FieldGroup>
        <h3 className="text-sm font-medium">
          {current
            ? t("New change (increment, promotion, allowance change)")
            : t("Record current package")}
        </h3>
        <p className="-mt-3 text-sm text-muted-foreground">
          {t(
            "A change is kept as a new row. An earlier row can't be edited: to correct a mistake, add a new row.",
          )}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pkgEffective">
              {t("Effective from")}
            </FieldLabel>
            <Input
              id="pkgEffective"
              name="effectiveOn"
              type="date"
              defaultValue={
                current
                  ? `${sheet.today.slice(0, 8)}01`
                  : (sheet.joinedOn ?? sheet.today)
              }
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pkgBasic">
              {t("Basic salary / month (RM)")}
            </FieldLabel>
            <Input
              id="pkgBasic"
              name="basic"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={current?.basic ?? ""}
              required
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pkgReason">{t("Reason")}</FieldLabel>
          <Input
            id="pkgReason"
            list="pkgReasons"
            value={reason}
            maxLength={200}
            placeholder={t("e.g. Annual increment 2027, Promotion S1 to S2")}
            onChange={(event) => setReason(event.target.value)}
          />
          <datalist id="pkgReasons">
            {REASONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>
        <Field>
          <FieldLabel>{t("Allowances / month")}</FieldLabel>
          <AllowanceEditor value={allowances} onChange={setAllowances} />
          {sheet.standard && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyStandard}
              >
                {t("Use")} {t(sheet.standard.title).toLowerCase()}
              </Button>
            </div>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pkgClaimCap">
              {t("Petrol + toll + parking claim max / month (RM)")}
            </FieldLabel>
            <Input
              id="pkgClaimCap"
              type="number"
              inputMode="decimal"
              min={0}
              step="10"
              value={claimCap}
              placeholder={
                standardCap == null
                  ? t("e.g. 500 to 700")
                  : `${t("standard")} ${standardCap}`
              }
              onChange={(event) => setClaimCap(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pkgHotel">
              {t("Hotel budget level")}
            </FieldLabel>
            <Select value={hotelLevel} onValueChange={setHotelLevel}>
              <SelectTrigger id="pkgHotel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>
                  {t("Auto")} ({t(HOTEL_LEVEL_LABEL[sheet.autoHotelLevel])} ·{" "}
                  {formatRm(sheet.hotelBudget[sheet.autoHotelLevel])})
                </SelectItem>
                {HOTEL_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(HOTEL_LEVEL_LABEL[level])} ·{" "}
                    {formatRm(sheet.hotelBudget[level])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="pkgConfirmed">
              {t("Confirmation date")}
            </FieldLabel>
            <Input
              id="pkgConfirmed"
              name="confirmedOn"
              type="date"
              defaultValue={sheet.details.confirmedOn ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pkgOffer">
              {t("Offer letter / contract (Drive link)")}
            </FieldLabel>
            <Input
              id="pkgOffer"
              name="offerLetterLink"
              inputMode="url"
              maxLength={500}
              defaultValue={sheet.details.offerLetterLink ?? ""}
              placeholder="https://drive.google.com/..."
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="pkgNote">{t("Notes")}</FieldLabel>
          <Input
            id="pkgNote"
            name="note"
            maxLength={500}
            defaultValue={sheet.details.note}
            placeholder={t("e.g. Company car, probation 3 months")}
          />
        </Field>
        {error && <FieldError>{t(error)}</FieldError>}
        <div className="flex flex-wrap justify-end gap-2">
          {sheet.history.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={saveDetails}
            >
              {t("Save details only")}
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending
              ? t("Saving...")
              : current
                ? t("Save new package")
                : t("Save package")}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
