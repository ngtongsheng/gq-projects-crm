import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { PageHeader } from "@/components/app/page-header";
import { PasteImportDialog } from "@/components/app/paste-import-dialog";
import { Button } from "@/components/ui/button";
import { isManager } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import { CompaniesTable } from "./companies-table";
import { parseCompanyFilters } from "./company-rows";
import {
  canAddContact,
  canImportCustomers,
  canRateCompany,
  canSetAccountType,
} from "./contact-access";
import { ContactDialog } from "./contact-form";
import { parseCustomerFilters, parseCustomersView } from "./customer-filters";
import { companyImportFields, contactImportFields } from "./customer-import";
import { importCustomers, previewCustomerImport } from "./import-actions";
import { canRequestOwnership } from "./ownership/ownership-access";
import { PeopleTable } from "./people-table";

export const metadata: Metadata = { title: "Customers" };

const companyRows = z.array(
  z.object({ id: z.string(), name: z.string(), rating: z.number().int() }),
);

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("cust");
  const params = await searchParams;
  const view = parseCustomersView(params);
  const filters = parseCustomerFilters(params);
  const supabase = await createClient();

  const [companiesResult, team] = await Promise.all([
    supabase.from("companies").select("id, name, rating").order("name"),
    getTeamDirectory(),
  ]);
  if (companiesResult.error) {
    throw new Error(
      `Could not load companies: ${companiesResult.error.message}`,
    );
  }
  const companies = companyRows.parse(companiesResult.data);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={isManager(me.jobRole) ? "All customers" : "My customers"}
        description={
          view === "companies"
            ? "Customers are kept by company. Each company has one type and its people under it."
            : "The first salesperson to register a mobile number owns that contact."
        }
        actions={
          <>
            {view === "people" && (
              <DownloadCsvButton
                path="/customers/export"
                query={{
                  q: filters.q,
                  owner: filters.owner,
                  rating: filters.rating?.toString(),
                  account: filters.account,
                }}
              />
            )}
            {canImportCustomers(me.jobRole) && (
              <PasteImportDialog
                title="Paste from sheet"
                description="Paste companies first, then the customers who work there."
                kinds={[
                  {
                    value: "companies",
                    label: "Companies",
                    columns: companyImportFields.map((field) => field.label),
                  },
                  {
                    value: "contacts",
                    label: "Customers",
                    columns: contactImportFields.map((field) => field.label),
                  },
                ]}
                preview={previewCustomerImport}
                save={importCustomers}
              />
            )}
            {canAddContact(me.jobRole) && (
              <ContactDialog
                companies={companies}
                team={team}
                canSetAccountType={canSetAccountType(me.jobRole)}
                canRateCompany={canRateCompany(me.jobRole)}
                canRequestOwnership={canRequestOwnership(me.jobRole, false)}
              />
            )}
          </>
        }
      />
      <nav aria-label="Customer view" className="inline-flex gap-1">
        <Button
          asChild
          size="sm"
          variant={view === "companies" ? "default" : "outline"}
        >
          <Link href="/customers">Companies</Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={view === "people" ? "default" : "outline"}
        >
          <Link href="/customers?view=people">All people</Link>
        </Button>
      </nav>
      {view === "companies" ? (
        <CompaniesTable
          filters={parseCompanyFilters(params)}
          team={team}
          canFilterByOwner={isManager(me.jobRole)}
        />
      ) : (
        <PeopleTable
          me={me}
          filters={filters}
          companies={companies}
          team={team}
        />
      )}
    </div>
  );
}
