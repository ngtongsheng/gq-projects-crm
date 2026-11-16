"use client";

import { Boxes } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMember } from "@/lib/auth/team-directory";
import { formatSampleQty, movesStillOut } from "@/lib/domain/samples";
import { formatDate, todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { SampleDialog } from "./sample-dialog";
import { ALL, filterSamples } from "./sample-filters";
import { SampleBackDialog, TakeOutSampleDialog } from "./sample-move-dialogs";
import { useSampleSelection } from "./sample-selection";
import type { SampleRow } from "./samples-data";

type SamplesListProps = {
  samples: readonly SampleRow[];
  team: readonly TeamMember[];
  meId: string;
  canEdit: boolean;
  /** The "Pickup form with ticked" button, built by the page. */
  pickupButton: ReactNode;
};

/** The sample list: search, product and brand filters, ticks for a pickup form, take out and back. */
export function SamplesList({
  samples,
  team,
  meId,
  canEdit,
  pickupButton,
}: SamplesListProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState(ALL);
  const [brand, setBrand] = useState(ALL);
  const { ticked, toggle } = useSampleSelection();

  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const products = [...new Set(samples.map((sample) => sample.product))].sort();
  const brands = [
    ...new Set(samples.map((sample) => sample.brand).filter(Boolean)),
  ].sort();
  const shown = filterSamples(samples, { query, product, brand });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search SKU or name, e.g. XCH-03 or Dawn")}
          aria-label={t("Search samples")}
          className="w-full sm:w-72"
        />
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger aria-label={t("Product")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("All products")}</SelectItem>
            {products.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger aria-label={t("Brand")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("All brands")}</SelectItem>
            {brands.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {shown.length} {t("SKUs")}
        </span>
        {canEdit && pickupButton}
      </div>
      {canEdit && (
        <p className="text-sm text-muted-foreground">
          {t("To collect from Best Link:")} <b>{t("New pickup form")}</b>
          {t(
            ", fill in, Print / Save as PDF, WhatsApp the PDF to Best Link. Or tick samples below first to fill them in for you.",
          )}
        </p>
      )}
      <DataTable
        rows={shown}
        getRowKey={(sample) => sample.id}
        empty={
          <EmptyState
            icon={Boxes}
            title={t("No samples recorded yet")}
            description={
              canEdit
                ? t("Click Add sample or Paste from sheet.")
                : t("Nothing matches. Clear the search or the filters.")
            }
          />
        }
        columns={[
          ...(canEdit
            ? [
                {
                  key: "select",
                  header: "",
                  className: "w-8",
                  cell: (sample: SampleRow) =>
                    sample.qty > 0 ? (
                      <Checkbox
                        aria-label={`${t("Select")} ${sample.sku || sample.name} ${t("for pickup form")}`}
                        checked={ticked.includes(sample.id)}
                        onCheckedChange={() => toggle(sample.id)}
                      />
                    ) : null,
                },
              ]
            : []),
          {
            key: "product",
            header: t("Product"),
            cell: (sample) => sample.product,
          },
          {
            key: "brand",
            header: t("Brand"),
            cell: (sample) => sample.brand,
          },
          {
            key: "sku",
            header: t("SKU"),
            cell: (sample) => (
              <span className="font-mono text-sm font-medium whitespace-nowrap">
                {sample.sku || "–"}
              </span>
            ),
          },
          {
            key: "name",
            header: t("Product name"),
            cell: (sample) => (
              <span className="font-medium">{sample.name}</span>
            ),
          },
          {
            key: "spec",
            header: t("Size / spec"),
            className: "max-sm:hidden",
            cell: (sample) => (
              <span className="text-muted-foreground">{sample.spec}</span>
            ),
          },
          {
            key: "qty",
            header: t("Qty at Best Link"),
            numeric: true,
            cell: (sample) => {
              const out = movesStillOut(sample.moves);
              return (
                <div className="flex flex-col items-end gap-0.5">
                  {sample.qty > 0 ? (
                    formatSampleQty(sample.qty, sample.unit)
                  ) : (
                    <StatusBadge tone="bad">{t("None left")}</StatusBadge>
                  )}
                  {out.map((move) => (
                    <span
                      key={move.id}
                      className="font-sans text-xs font-normal whitespace-normal text-muted-foreground"
                    >
                      {move.qty} {t("out ·")}{" "}
                      {move.takenBy
                        ? (nameOf.get(move.takenBy) ?? t("Unnamed"))
                        : t("Not set")}
                      {move.forWhom && ` (${move.forWhom})`}
                    </span>
                  ))}
                </div>
              );
            },
          },
          {
            key: "notes",
            header: t("Notes"),
            className: "max-sm:hidden",
            cell: (sample) => (
              <span className="text-muted-foreground">{sample.notes}</span>
            ),
          },
          {
            key: "updated",
            header: t("Updated"),
            cell: (sample) => (
              <div className="flex flex-col">
                <span className="font-mono text-sm whitespace-nowrap tabular-nums">
                  {formatDate(todayMyt(new Date(sample.updatedAt)))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {sample.updatedBy ? (nameOf.get(sample.updatedBy) ?? "") : ""}
                </span>
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            cell: (sample) =>
              canEdit ? (
                <div className="flex flex-wrap justify-end gap-1">
                  {sample.qty > 0 && (
                    <TakeOutSampleDialog
                      sample={sample}
                      team={team}
                      meId={meId}
                    />
                  )}
                  {movesStillOut(sample.moves).length > 0 && (
                    <SampleBackDialog sample={sample} nameOf={nameOf} />
                  )}
                  <SampleDialog
                    sample={sample}
                    brands={brands}
                    nameOf={nameOf}
                  />
                </div>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
