import { z } from "zod";
import { type QuoteRegisterRow, QuoteStatus } from "./quote-view";

export const RegisterSort = z.enum(["updated", "amount", "quoteNo"]);
export type RegisterSort = z.infer<typeof RegisterSort>;

export const RegisterSortLabel: Record<RegisterSort, string> = {
  updated: "Recently updated",
  amount: "Quote amount, highest first",
  quoteNo: "Quotation No.",
};

// Anything unrecognised falls back to no search, every status and recently updated first.
const filterParams = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
  status: QuoteStatus.optional().catch(undefined),
  sort: RegisterSort.catch("updated"),
});
export type RegisterFilters = z.infer<typeof filterParams>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function parseRegisterFilters(
  params: Record<string, string | string[] | undefined>,
): RegisterFilters {
  return filterParams.parse({
    search: first(params.search),
    status: first(params.status),
    sort: first(params.sort),
  });
}

type Row = Pick<
  QuoteRegisterRow,
  | "quoteNo"
  | "projectName"
  | "customerName"
  | "salespersonName"
  | "status"
  | "amount"
  | "updatedAt"
>;

/** Search matches the quotation number, project, customer or salesperson, as in the demo. */
export function applyRegisterFilters<Item extends Row>(
  rows: Item[],
  filters: RegisterFilters,
): Item[] {
  const needle = filters.search?.toLowerCase();
  const kept = rows.filter(
    (row) =>
      (!filters.status || row.status === filters.status) &&
      (!needle ||
        [row.quoteNo, row.projectName, row.customerName, row.salespersonName]
          .join(" ")
          .toLowerCase()
          .includes(needle)),
  );
  return kept.sort((a, b) => {
    if (filters.sort === "amount") return b.amount - a.amount;
    if (filters.sort === "quoteNo") return a.quoteNo.localeCompare(b.quoteNo);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
