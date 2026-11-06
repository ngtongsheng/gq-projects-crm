import type { NextRequest } from "next/server";
import { requireSection } from "@/lib/auth/require-section";
import { CustomerHealthLabel } from "@/lib/domain/customer-health";
import { formatMobile } from "@/lib/domain/mobile";
import { csvResponse } from "@/lib/format/csv-response";
import { loadCustomers } from "../customer-data";
import { filterCustomers, parseCustomerFilters } from "../customer-filters";
import { AccountTypeLabel, CompanyTypeLabel, RatingLabel } from "../schemas";

/** The customers list as CSV, with the same filters as the page. */
export async function GET(request: NextRequest) {
  const me = await requireSection("customers");
  const filters = parseCustomerFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const customers = filterCustomers(await loadCustomers(me), filters);

  return csvResponse(
    "customers",
    [
      "Customer",
      "Title",
      "Company",
      "Company type",
      "Mobile",
      "Owners",
      "Company rating",
      "Account type",
      "Activity",
    ],
    customers.map((row) => [
      row.name,
      row.title,
      row.companyName,
      CompanyTypeLabel[row.companyType],
      formatMobile(row.mobile),
      row.ownerNames.join(" + "),
      `${row.rating} · ${RatingLabel[row.rating]}`,
      AccountTypeLabel[row.accountType],
      CustomerHealthLabel[row.health],
    ]),
  );
}
