import type { CalendarDate } from "@/lib/format/date";
import {
  customSampleStatus,
  daysOverdue,
  openLoan,
} from "./custom-sample-status";
import type { CustomSample } from "./custom-sample-types";

export const CUSTOM_SAMPLE_FILTERS = [
  "all",
  "available",
  "on-loan",
  "overdue",
  "to-confirm",
  "mine",
  "given",
] as const;
export type CustomSampleFilter = (typeof CUSTOM_SAMPLE_FILTERS)[number];

export const CUSTOM_SAMPLE_FILTER_LABEL: Record<CustomSampleFilter, string> = {
  all: "All in hand",
  available: "Available",
  "on-loan": "On loan",
  overdue: "Overdue",
  "to-confirm": "Returned – to confirm",
  mine: "Borrowed by me",
  given: "Given away",
};

type Viewer = {
  meId: string;
  today: CalendarDate;
  /** Names by person id, so the search finds a salesperson by name. */
  nameOf: ReadonlyMap<string, string>;
};

function matchesFilter(
  sample: CustomSample,
  filter: CustomSampleFilter,
  { meId, today }: Viewer,
): boolean {
  const status = customSampleStatus(sample);
  switch (filter) {
    case "all":
      return status !== "given";
    case "available":
    case "on-loan":
    case "to-confirm":
    case "given":
      return status === filter;
    case "overdue":
      return daysOverdue(sample, today) > 0;
    case "mine":
      return openLoan(sample)?.salespersonId === meId;
  }
}

function searchText(sample: CustomSample, nameOf: Viewer["nameOf"]): string {
  const loan = openLoan(sample);
  return [
    sample.code,
    sample.designNo,
    sample.designName,
    sample.supplier,
    sample.notes,
    loan?.customer,
    loan ? nameOf.get(loan.salespersonId) : null,
  ]
    .join(" ")
    .toLowerCase();
}

/** The list under the search box and filter: most overdue first, then newest received (demo vTuft). */
export function filterCustomSamples(
  samples: readonly CustomSample[],
  filters: { query: string; filter: CustomSampleFilter },
  viewer: Viewer,
): CustomSample[] {
  const query = filters.query.trim().toLowerCase();
  return samples
    .filter(
      (sample) =>
        matchesFilter(sample, filters.filter, viewer) &&
        (query === "" || searchText(sample, viewer.nameOf).includes(query)),
    )
    .sort(
      (a, b) =>
        daysOverdue(b, viewer.today) - daysOverdue(a, viewer.today) ||
        b.receivedOn.localeCompare(a.receivedOn),
    );
}

export type CustomSampleTiles = {
  available: number;
  /** Every open loan, including one the borrower marked returned. */
  onLoan: number;
  withMe: number;
  overdue: number;
  toConfirm: number;
  given: number;
};

export function customSampleTiles(
  samples: readonly CustomSample[],
  { meId, today }: Pick<Viewer, "meId" | "today">,
): CustomSampleTiles {
  const tiles: CustomSampleTiles = {
    available: 0,
    onLoan: 0,
    withMe: 0,
    overdue: 0,
    toConfirm: 0,
    given: 0,
  };
  for (const sample of samples) {
    const status = customSampleStatus(sample);
    if (status === "available") tiles.available += 1;
    if (status === "given") tiles.given += 1;
    if (status === "to-confirm") tiles.toConfirm += 1;
    if (status === "on-loan" || status === "to-confirm") {
      tiles.onLoan += 1;
      if (openLoan(sample)?.salespersonId === meId) tiles.withMe += 1;
    }
    if (daysOverdue(sample, today) > 0) tiles.overdue += 1;
  }
  return tiles;
}
