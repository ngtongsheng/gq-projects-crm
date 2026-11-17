import { sumRm } from "@/lib/format/money";
import { VENDOR_SKILL_LABEL, VENDOR_SUPPLY_LABEL } from "./marketing-options";
import type { MarketingVendor } from "./marketing-types";

export type VendorTab = "all" | "company" | "part_timer";
export type VendorSort = "name" | "spend";

export type VendorRow = MarketingVendor & {
  /** Expense lines in the chosen year. */
  invoices: number;
  /** RM paid in the chosen year. */
  total: number;
  /** Date of the latest expense line in any year. */
  lastPaidOn: string | null;
  /** Expense lines and prepaid entries; the vendor cannot be deleted while this is above 0. */
  used: number;
};

/** Each vendor with the year's invoices and total, matched by vendor (demo mkVend). */
export function vendorRows(
  vendors: readonly MarketingVendor[],
  year: string,
): VendorRow[] {
  return vendors.map((vendor) => {
    const inYear = vendor.payments.filter((payment) =>
      payment.spentOn.startsWith(`${year}-`),
    );
    return {
      ...vendor,
      invoices: inYear.length,
      total: sumRm(inYear.map((payment) => payment.amountRm)),
      lastPaidOn:
        vendor.payments
          .map((payment) => payment.spentOn)
          .sort()
          .at(-1) ?? null,
      used: vendor.payments.length + vendor.prepaidEntries,
    };
  });
}

export const vendorTabCounts = (rows: readonly VendorRow[]) => ({
  all: rows.length,
  company: rows.filter((row) => row.kind === "company").length,
  part_timer: rows.filter((row) => row.kind === "part_timer").length,
});

function searchText(row: VendorRow): string {
  return [
    row.name,
    row.supplies && VENDOR_SUPPLY_LABEL[row.supplies],
    row.contactPerson,
    row.phone,
    row.email,
    row.notes,
    ...row.skills.map((skill) => VENDOR_SKILL_LABEL[skill]),
  ]
    .join(" ")
    .toLowerCase();
}

/** The vendors under the tabs and search, A-Z or highest spend first (demo mkVendView). */
export function filterVendors(
  rows: readonly VendorRow[],
  filters: { tab: VendorTab; query: string; sort: VendorSort },
): VendorRow[] {
  const needle = filters.query.trim().toLowerCase();
  return rows
    .filter(
      (row) =>
        (filters.tab === "all" || row.kind === filters.tab) &&
        (needle === "" || searchText(row).includes(needle)),
    )
    .sort((a, b) =>
      filters.sort === "spend"
        ? b.total - a.total || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
}
