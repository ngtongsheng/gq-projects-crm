"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ItemTotals } from "@/lib/domain/costing";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import type { Translate } from "@/lib/i18n/translate";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  isSupplyCategory,
  SOURCE_LABEL,
  SOURCES,
  type Source,
  typeAllowedIn,
  UNIT_LABEL,
  UNITS,
} from "./item-kinds";
import { MarginPill } from "./margin-pill";
import { Labeled, NumberBox } from "./number-box";
import type { DraftItem } from "./quote-draft";

type NumberKey =
  | "material"
  | "wastagePct"
  | "underlay"
  | "accessories"
  | "install"
  | "fob"
  | "fx"
  | "sstPct"
  | "shipping"
  | "length"
  | "width"
  | "pieceCost"
  | "edging"
  | "lumpCost";

type CostField = {
  key: NumberKey;
  label: string;
  /** Shown to people without the margin flag too (the customer's size of a rug). */
  sellSide?: boolean;
};

/** The boxes each kind of line needs, in the order the demo shows them. */
function costFields(item: DraftItem, t: Translate): CostField[] {
  const per = UNIT_LABEL[item.unit];
  const supplyOnly = item.category === "supply";
  const wastage: CostField = { key: "wastagePct", label: t("Wastage %") };
  const installing = (fields: CostField[]) => (supplyOnly ? [] : fields);
  const perM2 = item.unit === "sqft" || item.unit === "m2" ? "m²" : per;
  const landed = (unit: string): CostField[] => [
    { key: "fob", label: `${t("FOB /")} ${unit}` },
    { key: "fx", label: `1 ${item.currency} = RM` },
    { key: "sstPct", label: t("SST %") },
    { key: "shipping", label: `${t("Shipment RM /")} ${unit}` },
  ];
  switch (item.type) {
    case "local":
      return [
        { key: "material", label: `${t("Supply price RM /")} ${per}` },
        wastage,
        ...installing([
          { key: "install", label: `${t("Installation RM /")} ${per}` },
          { key: "underlay", label: `${t("Underlay RM /")} ${per}` },
          { key: "accessories", label: `${t("Accessories RM /")} ${per}` },
        ]),
      ];
    case "import":
      return [
        ...landed(perM2),
        wastage,
        ...installing([
          { key: "install", label: `${t("Installation RM /")} ${per}` },
          { key: "underlay", label: `${t("Underlay RM /")} ${per}` },
        ]),
      ];
    case "rug":
      return [
        { key: "length", label: t("Length L (m)"), sellSide: true },
        { key: "width", label: t("Width W (m)"), sellSide: true },
        ...(item.rugMode === "piece"
          ? [{ key: "pieceCost" as const, label: t("Price per piece RM") }]
          : landed("m²")),
        wastage,
        { key: "edging", label: t("Edging RM / pc") },
        ...installing([{ key: "install", label: t("Installation RM / pc") }]),
      ];
    case "labour":
      return [
        { key: "install", label: `${t("Labour RM /")} ${per}` },
        { key: "underlay", label: `${t("Underlay RM /")} ${per}` },
        {
          key: "accessories",
          label: `${t("Adhesive / accessories RM /")} ${per}`,
        },
      ];
    case "lump":
      return [{ key: "lumpCost", label: `${t("Cost RM /")} ${per}` }];
    case "simple":
      if (item.category === "acc") {
        return [{ key: "material", label: `${t("Cost RM /")} ${per}` }];
      }
      if (item.category === "sl") {
        return [
          { key: "material", label: `${t("Material RM /")} ${per}` },
          { key: "install", label: `${t("Labour RM /")} ${per}` },
        ];
      }
      return [{ key: "install", label: `${t("Labour cost RM /")} ${per}` }];
    case "discount":
      return [];
  }
}

const NO_LINK = "none";

export type LinkChoice = { ref: string; label: string };

export function ItemRow({
  index,
  item,
  costShown,
  disabled,
  totals,
  linkChoices,
  onChange,
  onChangeCategory,
  onChangeSource,
  onRemove,
}: {
  index: number;
  item: DraftItem;
  costShown: boolean;
  disabled: boolean;
  totals: ItemTotals;
  /** The supply lines an installation line can follow. */
  linkChoices: LinkChoice[];
  onChange: (changes: Partial<DraftItem>) => void;
  onChangeCategory: (category: DraftItem["category"]) => void;
  onChangeSource: (source: Source) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const discount = item.type === "discount";
  const followsLine = item.type === "labour" && item.linkRef !== "";
  // A saved line keeps its formula for people who cannot see cost: its cost fields are theirs to
  // leave alone. A new line can start as any kind.
  const canChooseSource = costShown || item.id === null;
  const categories = costShown
    ? CATEGORIES
    : CATEGORIES.filter((category) =>
        item.id === null ? true : typeAllowedIn(category, item.type),
      );
  const fields = costFields(item, t).filter(
    (field) => costShown || field.sellSide,
  );
  const showsSupplier =
    isSupplyCategory(item.category) && item.type !== "local";
  const showsCurrency =
    costShown &&
    (item.type === "import" ||
      (item.type === "rug" && item.rugMode === "area"));

  return (
    <div className="flex flex-col gap-3 border-b p-3 last:border-b-0">
      <div className="grid gap-2 sm:grid-cols-[2rem_minmax(0,1fr)_11rem_2rem]">
        <span className="hidden pt-1.5 font-mono text-sm font-semibold sm:block">
          {index + 1}
        </span>
        <div className="flex flex-col gap-1.5">
          <Input
            aria-label={`${t("Item")} ${index + 1} ${t("product")}`}
            value={item.product}
            onChange={(event) => onChange({ product: event.target.value })}
            placeholder={t("e.g. Carpet Tile: FTP-202B Essential Color")}
            maxLength={200}
            disabled={disabled}
            className="font-semibold"
          />
          <Textarea
            aria-label={`${t("Item")} ${index + 1} ${t("description")}`}
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder={t("Description for the quotation (optional)")}
            rows={Math.max(1, item.description.split("\n").length)}
            maxLength={2000}
            disabled={disabled}
            className="min-h-0"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Select
            value={item.category}
            onValueChange={(value) => {
              const category = CATEGORIES.find((known) => known === value);
              if (category) onChangeCategory(category);
            }}
            disabled={disabled}
          >
            <SelectTrigger
              aria-label={`${t("Item")} ${index + 1} ${t("category")}`}
              className="w-full font-medium"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {t(CATEGORY_LABEL[category])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSupplyCategory(item.category) && canChooseSource && (
            <Select
              value={item.type}
              onValueChange={(value) => {
                const source = SOURCES.find((known) => known === value);
                if (source) onChangeSource(source);
              }}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={`${t("Item")} ${index + 1} ${t("source")}`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {t(SOURCE_LABEL[source])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            variant={confirmingRemove ? "destructive" : "ghost"}
            size={confirmingRemove ? "sm" : "icon-sm"}
            aria-label={`${t("Remove item")} ${index + 1}`}
            onClick={() => {
              if (!confirmingRemove) return setConfirmingRemove(true);
              onRemove();
            }}
            onBlur={() => setConfirmingRemove(false)}
          >
            {confirmingRemove ? t("Sure?") : <X />}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 sm:pl-8">
        {discount ? (
          <NumberBox
            label={t("Discount RM (taken off the total)")}
            value={item.rate}
            onChange={(rate) => onChange({ rate })}
            disabled={disabled}
            className="w-56"
          />
        ) : (
          <>
            <NumberBox
              label={t("Qty")}
              value={item.qty}
              onChange={(qty) => onChange({ qty })}
              disabled={disabled || followsLine}
              className="w-24"
            />
            <Labeled label={t("Unit")} className="w-24">
              <Select
                value={item.unit}
                onValueChange={(value) => {
                  const unit = UNITS.find((known) => known === value);
                  if (unit) onChange({ unit });
                }}
                disabled={disabled || followsLine || item.type === "rug"}
              >
                <SelectTrigger aria-label={t("Unit")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {t(UNIT_LABEL[unit])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labeled>
            <NumberBox
              label={t("Rate RM")}
              value={item.rate}
              onChange={(rate) => onChange({ rate })}
              disabled={disabled}
            />
          </>
        )}
        {showsSupplier && (
          <Labeled label={t("Supplier")} className="w-40">
            <Input
              value={item.supplier}
              onChange={(event) => onChange({ supplier: event.target.value })}
              placeholder={t("China supplier")}
              maxLength={200}
              disabled={disabled}
            />
          </Labeled>
        )}
        <Labeled label={t("Area")} className="w-40">
          <Input
            aria-label={t("Area")}
            value={item.area}
            onChange={(event) => onChange({ area: event.target.value })}
            placeholder={t("e.g. Level 3 office")}
            maxLength={200}
            disabled={disabled}
          />
        </Labeled>
        <div className="ml-auto flex items-end gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">{t("Amount")}</span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {formatRm(totals.sell)}
            </span>
          </div>
          {costShown && !discount && (
            <>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">
                  {t("Total cost")}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {formatRm(totals.cost)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">
                  {t("Margin")}
                </span>
                <MarginPill costShown margin={totals.margin} level={null} />
              </div>
            </>
          )}
        </div>
      </div>

      {(fields.length > 0 ||
        item.type === "labour" ||
        item.type === "rug" ||
        showsCurrency) && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2 sm:ml-8">
          {item.type === "rug" && costShown && (
            <Labeled label={t("Priced by")} className="w-48">
              <Select
                value={item.rugMode}
                onValueChange={(value) =>
                  onChange({ rugMode: value === "piece" ? "piece" : "area" })
                }
                disabled={disabled}
              >
                <SelectTrigger aria-label={t("Priced by")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">
                    {t("FOB per m² (imported)")}
                  </SelectItem>
                  <SelectItem value="piece">
                    {t("Supplier price per piece")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Labeled>
          )}
          {showsCurrency && (
            <Labeled label={t("Currency")} className="w-24">
              <Select
                value={item.currency}
                onValueChange={(value) =>
                  onChange({
                    currency: value === "RMB" ? "RMB" : "USD",
                    fx: "",
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger aria-label={t("Currency")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="RMB">RMB</SelectItem>
                </SelectContent>
              </Select>
            </Labeled>
          )}
          {item.type === "labour" && (
            <Labeled label={t("Installs which item")} className="w-56">
              <Select
                value={item.linkRef === "" ? NO_LINK : item.linkRef}
                onValueChange={(value) =>
                  onChange({ linkRef: value === NO_LINK ? "" : value })
                }
                disabled={disabled}
              >
                <SelectTrigger
                  aria-label={t("Installs which item")}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LINK}>{t("Not linked")}</SelectItem>
                  {linkChoices.map((choice) => (
                    <SelectItem key={choice.ref} value={choice.ref}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labeled>
          )}
          {fields.map((field) => (
            <NumberBox
              key={field.key}
              label={field.label}
              value={item[field.key]}
              onChange={(value) => onChange({ [field.key]: value })}
              disabled={disabled}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 sm:pl-8">
        <Labeled label={t("Internal remark")} className="w-full sm:w-72">
          <Input
            aria-label={t("Internal remark")}
            value={item.remark}
            onChange={(event) => onChange({ remark: event.target.value })}
            maxLength={500}
            disabled={disabled}
          />
        </Labeled>
      </div>
    </div>
  );
}
