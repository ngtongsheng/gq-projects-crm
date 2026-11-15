import { z } from "zod";
import { AccountType } from "./schemas";

/** What the list needs from a contact to search and filter it. */
export type FilterableCustomer = {
  name: string;
  companyName: string;
  mobile: string;
  rating: number;
  accountType: AccountType;
  ownerIds: string[];
};

// The filter form posts "all" for "no filter"; anything unrecognised also means no filter.
const filterParams = z.object({
  q: z.string().trim().catch(""),
  owner: z.uuid().optional().catch(undefined),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  account: AccountType.optional().catch(undefined),
});
export type CustomerFilters = z.infer<typeof filterParams>;

export function parseCustomerFilters(
  params: Record<string, string | string[] | undefined>,
): CustomerFilters {
  return filterParams.parse({
    q: params.q ?? "",
    owner: params.owner,
    rating: params.rating,
    account: params.account,
  });
}

export type CustomersView = "companies" | "people";

/** The Companies / All people toggle lives in the link, so it survives a reload. Companies is the default. */
export function parseCustomersView(
  params: Record<string, string | string[] | undefined>,
): CustomersView {
  return params.view === "people" ? "people" : "companies";
}

const digitsOf = (text: string) => text.replace(/\D/g, "");

export function filterCustomers<Row extends FilterableCustomer>(
  rows: Row[],
  filters: CustomerFilters,
): Row[] {
  const query = filters.q.toLowerCase();
  const queryDigits = digitsOf(filters.q);

  return rows.filter((row) => {
    if (filters.owner && !row.ownerIds.includes(filters.owner)) return false;
    if (filters.rating && row.rating !== filters.rating) return false;
    if (filters.account && row.accountType !== filters.account) return false;
    if (!query) return true;
    // Digits-only search matches any way of writing the number, e.g. 012-345.
    const matchesMobile =
      queryDigits !== "" &&
      row.mobile.includes(
        queryDigits.startsWith("0") ? queryDigits.slice(1) : queryDigits,
      );
    return (
      row.name.toLowerCase().includes(query) ||
      row.companyName.toLowerCase().includes(query) ||
      matchesMobile
    );
  });
}
