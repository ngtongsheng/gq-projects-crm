import { toCents } from "@/lib/format/money";

/** The MOF fields whose changes are kept; values mirror the mof_changes field check. */
export const MOF_CHANGE_FIELDS = [
  "contract_sum",
  "cost",
  "installer_name",
  "scope",
  "salesperson_id",
  "second_salesperson_id",
  "commission_type",
  "loa_date",
  "lines",
  "order_total",
] as const;
export type MofChangeField = (typeof MOF_CHANGE_FIELDS)[number];

/** A product line as the change history summarises it; `unit` is its shown label. */
export type DiffLine = { product: string; qty: number; unit: string };

/** The tracked fields of an MOF. `cost` is left out when the person may not see it. */
export type MofSnapshot = {
  contractSum: number;
  cost?: number | null;
  installerName: string | null;
  scope: string;
  salespersonId: string;
  secondSalespersonId: string | null;
  commissionType: string;
  loaDate: string;
  lines: readonly DiffLine[];
};

/** One field's change; a blank value is null. */
export type MofChange = {
  field: MofChangeField;
  from: string | null;
  to: string | null;
};

const blankToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

/** The product lines in one line, e.g. "Carpet Tile 250 m², Carpet Roll 3 roll". */
export function linesSummary(lines: readonly DiffLine[]): string | null {
  return blankToNull(
    lines
      .map((line) => `${line.product.trim()} ${line.qty} ${line.unit}`)
      .join(", "),
  );
}

const textChange = (
  field: MofChangeField,
  saved: string | null,
  posted: string | null,
): MofChange[] => {
  const from = blankToNull(saved);
  const to = blankToNull(posted);
  return from === to ? [] : [{ field, from, to }];
};

const moneyChange = (
  field: MofChangeField,
  saved: number | null,
  posted: number,
): MofChange[] =>
  saved !== null && toCents(saved) === toCents(posted)
    ? []
    : [
        {
          field,
          from: saved === null ? null : String(saved),
          to: String(posted),
        },
      ];

/**
 * What a save changes on an MOF, field by field. A cost is compared only when one is posted:
 * a blank or hidden cost leaves the saved one alone.
 */
export function mofDiff(saved: MofSnapshot, posted: MofSnapshot): MofChange[] {
  return [
    ...moneyChange("contract_sum", saved.contractSum, posted.contractSum),
    ...(typeof posted.cost === "number"
      ? moneyChange("cost", saved.cost ?? null, posted.cost)
      : []),
    ...textChange("installer_name", saved.installerName, posted.installerName),
    ...textChange("scope", saved.scope, posted.scope),
    ...textChange("salesperson_id", saved.salespersonId, posted.salespersonId),
    ...textChange(
      "second_salesperson_id",
      saved.secondSalespersonId,
      posted.secondSalespersonId,
    ),
    ...textChange(
      "commission_type",
      saved.commissionType,
      posted.commissionType,
    ),
    ...textChange("loa_date", saved.loaDate, posted.loaDate),
    ...textChange(
      "lines",
      linesSummary(saved.lines),
      linesSummary(posted.lines),
    ),
  ];
}

/** A change to a completed job, or to the contract sum (and so the order total), needs a reason. */
export function changeNeedsReason(
  changes: readonly MofChange[],
  jobCompleted: boolean,
): boolean {
  return (
    changes.some((change) => change.field === "contract_sum") ||
    (jobCompleted && changes.length > 0)
  );
}
