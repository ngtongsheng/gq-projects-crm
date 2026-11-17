"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import { DataTable } from "@/components/app/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { openCustomSamplePhoto } from "./custom-sample-actions";
import {
  customSampleStatus,
  daysOverdue,
  openLoan,
} from "./custom-sample-status";
import { CustomSampleStatusBadge } from "./custom-sample-status-badge";
import type { CustomSample, CustomSampleLoan } from "./custom-sample-types";

type CustomSampleSheetProps = {
  sample: CustomSample;
  /** Name by person id, for everyone the sheet mentions. */
  names: ReadonlyMap<string, string>;
  today: CalendarDate;
  onClose: () => void;
  /** The Edit and Borrow buttons, built by the list for the people who may use them. */
  actions: ReactNode;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** The sample's detail (demo sheetTfOpen): photo, facts, who has it now, the loan history. */
export function CustomSampleSheet({
  sample,
  names,
  today,
  onClose,
  actions,
}: CustomSampleSheetProps) {
  const t = useT();
  const nameOf = (id: string) => names.get(id) ?? t("Unnamed");
  const loan = openLoan(sample);
  const overdue = daysOverdue(sample, today);
  const photoUrl = useFreshPhotoUrl(sample);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-lg">
            <span className="font-mono">{sample.code}</span> ·{" "}
            {sample.designName}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CustomSampleStatusBadge
              status={customSampleStatus(sample)}
              overdueDays={overdue}
              t={t}
            />
            <span>
              {t("received")} {formatDate(sample.receivedOn)} (
              {nameOf(sample.recordedBy)})
            </span>
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
          {photoUrl && (
            <Image
              src={photoUrl}
              alt={sample.designName}
              width={512}
              height={512}
              unoptimized
              className="h-auto max-h-64 w-auto max-w-full self-start rounded-lg object-contain"
            />
          )}
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
            <Row label={t("Supplier")}>{sample.supplier ?? "–"}</Row>
            <Row label={t("Design no.")}>{sample.designNo}</Row>
            <Row label={t("Size")}>
              {sample.size ?? "–"}
              {sample.qty > 1 && ` · ${sample.qty} ${t("pcs")}`}
            </Row>
            {sample.notes && <Row label={t("Notes")}>{sample.notes}</Row>}
            {loan && (
              <Row label={t("With")}>
                <b>{nameOf(loan.salespersonId)}</b> {t("for")} {loan.customer}
                {loan.project && ` – ${loan.project}`}
                <br />
                {t("borrowed")} {formatDate(loan.outOn)} · {t("return by")}{" "}
                <b className={overdue > 0 ? "text-bad" : undefined}>
                  {formatDate(loan.dueOn)}
                </b>
              </Row>
            )}
            {sample.givenOn && (
              <Row label={t("Given away")}>
                {formatDate(sample.givenOn)} {t("to")} <b>{sample.givenTo}</b>{" "}
                {t("by")} {sample.givenBy ? nameOf(sample.givenBy) : "–"}
                <br />
                {t("Reason")}: {sample.giftReason}
              </Row>
            )}
          </dl>
          {sample.loans.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="font-heading text-sm font-semibold">
                {t("Loan history")}
              </h3>
              <DataTable
                rows={sample.loans.toReversed()}
                getRowKey={(row) => row.id}
                columns={[
                  {
                    key: "who",
                    header: t("Salesperson"),
                    cell: (row) => nameOf(row.salespersonId),
                  },
                  {
                    key: "customer",
                    header: t("Customer"),
                    cell: (row) => (
                      <span className="whitespace-normal">
                        {row.customer}
                        {row.project && (
                          <span className="block text-xs text-muted-foreground">
                            {row.project}
                          </span>
                        )}
                      </span>
                    ),
                  },
                  {
                    key: "out",
                    header: t("Out"),
                    numeric: true,
                    cell: (row) => formatDate(row.outOn),
                  },
                  {
                    key: "back",
                    header: t("Back"),
                    cell: (row) => <BackCell loan={row} today={today} />,
                  },
                ]}
              />
            </section>
          )}
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BackCell({
  loan,
  today,
}: {
  loan: CustomSampleLoan;
  today: CalendarDate;
}) {
  const t = useT();
  if (loan.givenAway) return <>{t("Given away")}</>;
  if (loan.backOn) return <>{formatDate(loan.backOn)}</>;
  return (
    <span
      className={
        loan.dueOn < today && loan.returnedMarkedOn === null
          ? "font-semibold text-bad"
          : "text-info"
      }
    >
      {t("due")} {formatDate(loan.dueOn)}
    </span>
  );
}

/**
 * The photo link the page signed lasts minutes, so the sheet asks for a fresh one when it opens;
 * the page's link shows meanwhile (and stays when no fresh one can be made, e.g. on a laptop).
 */
function useFreshPhotoUrl(sample: CustomSample): string | null {
  const [fresh, setFresh] = useState<string | null>(null);
  const { id, photoPath } = sample;
  useEffect(() => {
    if (!photoPath) return;
    let current = true;
    void openCustomSamplePhoto(id).then((result) => {
      if (current && result.error === null) setFresh(result.url);
    });
    return () => {
      current = false;
    };
  }, [id, photoPath]);
  return fresh ?? sample.photoUrl;
}
