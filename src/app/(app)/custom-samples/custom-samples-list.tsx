"use client";

import { Layers } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isOneOf } from "@/lib/form/one-of";
import { formatDate } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { BorrowSampleDialog } from "./borrow-sample-dialog";
import {
  CUSTOM_SAMPLE_FILTER_LABEL,
  CUSTOM_SAMPLE_FILTERS,
  type CustomSampleFilter,
  customSampleTiles,
  filterCustomSamples,
} from "./custom-sample-filters";
import { CustomSampleThumb } from "./custom-sample-photo";
import { CustomSampleSheet } from "./custom-sample-sheet";
import {
  customSampleStatus,
  daysOverdue,
  openLoan,
} from "./custom-sample-status";
import { CustomSampleStatusBadge } from "./custom-sample-status-badge";
import { CustomSampleTilesRow } from "./custom-sample-tiles";
import type { CustomSample } from "./custom-sample-types";
import { RecordSampleDialog } from "./record-sample-dialog";

type CustomSamplesListProps = {
  samples: readonly CustomSample[];
  /** Name by person id. */
  names: Record<string, string>;
  meId: string;
  meName: string;
  today: string;
  loanDays: number;
  canKeep: boolean;
  canBorrow: boolean;
  /** The salespeople the MD lends to; null when the person borrows for themselves. */
  sellers: readonly { id: string; name: string }[] | null;
  customers: readonly string[];
};

/** Tiles, search, filter and the list of custom samples; a sample opens in a sheet. */
export function CustomSamplesList({
  samples,
  names,
  meId,
  meName,
  today,
  loanDays,
  canKeep,
  canBorrow,
  sellers,
  customers,
}: CustomSamplesListProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomSampleFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const nameOf = new Map(Object.entries(names));
  const tiles = customSampleTiles(samples, { meId, today });
  const shown = filterCustomSamples(
    samples,
    { query, filter },
    { meId, today, nameOf },
  );
  const suppliers = [
    ...new Set(samples.flatMap((sample) => sample.supplier ?? [])),
  ].sort();
  const opened = samples.find((sample) => sample.id === openId);

  const borrowButton = (sample: CustomSample) =>
    canBorrow && customSampleStatus(sample) === "available" ? (
      <BorrowSampleDialog
        sample={sample}
        loanDays={loanDays}
        customers={customers}
        sellers={sellers}
        meName={meName}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <CustomSampleTilesRow
        tiles={tiles}
        loanDays={loanDays}
        canKeep={canKeep}
        onPick={setFilter}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search design no., name, client, salesperson")}
          aria-label={t("Search custom samples")}
          className="w-full sm:w-80"
        />
        <Select
          value={filter}
          onValueChange={(value) => {
            if (isOneOf(CUSTOM_SAMPLE_FILTERS, value)) setFilter(value);
          }}
        >
          <SelectTrigger aria-label={t("Show")} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOM_SAMPLE_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(CUSTOM_SAMPLE_FILTER_LABEL[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {shown.length} {t("samples")}
        </span>
      </div>
      <DataTable
        rows={shown}
        getRowKey={(sample) => sample.id}
        rowClassName={(sample) =>
          daysOverdue(sample, today) > 0 ? "bg-bad-bg/40" : undefined
        }
        empty={
          <EmptyState
            icon={Layers}
            title={t("No sample here")}
            description={
              samples.length === 0 && canKeep
                ? t("Click Record new sample when one arrives.")
                : t("Nothing matches. Clear the search or the filter.")
            }
          />
        }
        columns={[
          {
            key: "photo",
            header: "",
            className: "w-14",
            cell: (sample) => <CustomSampleThumb url={sample.photoUrl} />,
          },
          {
            key: "sample",
            header: t("Sample"),
            cell: (sample) => (
              <button
                type="button"
                onClick={() => setOpenId(sample.id)}
                className="flex flex-col text-left whitespace-normal hover:underline"
              >
                <span className="font-mono text-sm font-semibold">
                  {sample.code}
                </span>
                <span className="text-sm text-muted-foreground">
                  <b className="font-semibold text-foreground">
                    {sample.designNo}
                  </b>{" "}
                  · {sample.designName}
                </span>
              </button>
            ),
          },
          {
            key: "supplier",
            header: `${t("Supplier")} · ${t("size")}`,
            className: "max-md:hidden",
            cell: (sample) => (
              <span className="flex flex-col whitespace-normal">
                {sample.supplier}
                <span className="text-xs text-muted-foreground">
                  {[sample.size, sample.qty > 1 && `${sample.qty} ${t("pcs")}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            ),
          },
          {
            key: "received",
            header: t("Received"),
            className: "max-md:hidden",
            cell: (sample) => (
              <span className="flex flex-col">
                <span className="font-mono text-sm tabular-nums">
                  {formatDate(sample.receivedOn)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {names[sample.recordedBy] ?? ""}
                </span>
              </span>
            ),
          },
          {
            key: "status",
            header: t("Status"),
            cell: (sample) => {
              const loan = openLoan(sample);
              return (
                <span className="flex flex-col items-start gap-0.5">
                  <CustomSampleStatusBadge
                    status={customSampleStatus(sample)}
                    overdueDays={daysOverdue(sample, today)}
                    t={t}
                  />
                  {loan?.returnedMarkedOn && (
                    <span className="text-xs whitespace-normal text-muted-foreground">
                      {names[loan.salespersonId] ?? t("Unnamed")}{" "}
                      {t("returned")} {formatDate(loan.returnedMarkedOn)}
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            key: "with",
            header: t("With / client"),
            className: "max-lg:hidden",
            cell: (sample) => {
              const loan = openLoan(sample);
              if (loan) {
                return (
                  <span className="flex flex-col whitespace-normal">
                    <b>{names[loan.salespersonId] ?? t("Unnamed")}</b>
                    <span className="text-xs text-muted-foreground">
                      {loan.customer}
                      {loan.project && ` – ${loan.project}`}
                    </span>
                  </span>
                );
              }
              return sample.givenTo ? (
                <span className="text-xs whitespace-normal text-muted-foreground">
                  {t("to")} {sample.givenTo}
                </span>
              ) : null;
            },
          },
          {
            key: "due",
            header: t("Return by"),
            className: "max-lg:hidden",
            numeric: true,
            cell: (sample) => {
              const loan = openLoan(sample);
              return loan ? formatDate(loan.dueOn) : null;
            },
          },
          {
            key: "actions",
            header: "",
            cell: borrowButton,
          },
        ]}
      />
      {opened && (
        <CustomSampleSheet
          key={opened.id}
          sample={opened}
          names={nameOf}
          today={today}
          onClose={() => setOpenId(null)}
          actions={
            <>
              {canKeep && (
                <RecordSampleDialog sample={opened} suppliers={suppliers} />
              )}
              {borrowButton(opened)}
            </>
          }
        />
      )}
    </div>
  );
}
