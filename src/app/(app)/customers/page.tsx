import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { formatMobile } from "@/lib/domain/mobile";
import { createClient } from "@/lib/supabase/server";
import { canAddContact, canSetAccountType } from "./contact-access";
import { ContactDialog } from "./contact-form";
import { loadCustomers } from "./customer-data";
import { filterCustomers, parseCustomerFilters } from "./customer-filters";
import { CustomerHealthBadge } from "./customer-health-badge";
import { canRequestOwnership } from "./ownership/ownership-access";
import { RequestOwnershipDialog } from "./ownership/request-ownership-dialog";
import {
  AccountType,
  AccountTypeLabel,
  CompanyTypeLabel,
  RatingLabel,
} from "./schemas";

export const metadata: Metadata = { title: "Customers" };

const ALL = "all";

const ratingTone: Record<number, StatusTone> = {
  1: "bad",
  2: "warn",
  3: "neutral",
  4: "info",
  5: "good",
};

const companyRows = z.array(z.object({ id: z.string(), name: z.string() }));

const pendingRequestRows = z.array(z.object({ contact_id: z.string() }));

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("customers");
  const filters = parseCustomerFilters(await searchParams);
  const supabase = await createClient();

  const [allCustomers, companiesResult, pendingResult, team] =
    await Promise.all([
      loadCustomers(me),
      supabase.from("companies").select("id, name").order("name"),
      supabase
        .from("ownership_requests")
        .select("contact_id")
        .eq("requested_by", me.id)
        .eq("status", "pending"),
      getTeamDirectory(),
    ]);
  if (companiesResult.error) {
    throw new Error(
      `Could not load companies: ${companiesResult.error.message}`,
    );
  }
  if (pendingResult.error) {
    throw new Error(
      `Could not load your ownership requests: ${pendingResult.error.message}`,
    );
  }
  const companies = companyRows.parse(companiesResult.data);
  const requestedIds = new Set(
    pendingRequestRows.parse(pendingResult.data).map((row) => row.contact_id),
  );
  const customers = allCustomers.map((customer) => ({
    ...customer,
    requested: requestedIds.has(customer.id),
  }));
  const rows = filterCustomers(customers, filters);
  const isFiltered =
    filters.q !== "" ||
    filters.owner !== undefined ||
    filters.rating !== undefined ||
    filters.account !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Customers"
        description="Kept by company. The mobile number decides who owns a customer."
        actions={
          <>
            <DownloadCsvButton
              path="/customers/export"
              query={{
                q: filters.q,
                owner: filters.owner,
                rating: filters.rating?.toString(),
                account: filters.account,
              }}
            />
            {canAddContact(me.jobRole) && (
              <ContactDialog
                companies={companies}
                team={team}
                canSetAccountType={canSetAccountType(me.jobRole)}
                canRequestOwnership={canRequestOwnership(me.jobRole, false)}
              />
            )}
          </>
        }
      />
      <form action="/customers" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          type="search"
          aria-label="Search customers"
          placeholder="Search name, company or mobile"
          defaultValue={filters.q}
          className="w-full sm:w-64"
        />
        <Select name="owner" defaultValue={filters.owner ?? ALL}>
          <SelectTrigger aria-label="Owner" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All owners</SelectItem>
            {team.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="rating" defaultValue={String(filters.rating ?? ALL)}>
          <SelectTrigger aria-label="Rating" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any rating</SelectItem>
            {Object.entries(RatingLabel).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {value} · {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="account" defaultValue={filters.account ?? ALL}>
          <SelectTrigger aria-label="Account type" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any account type</SelectItem>
            {AccountType.options.map((type) => (
              <SelectItem key={type} value={type}>
                {AccountTypeLabel[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Search
        </Button>
        {isFiltered && (
          <Button asChild variant="ghost">
            <a href="/customers">Clear</a>
          </Button>
        )}
      </form>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Users}
            title={isFiltered ? "No customers match" : "No customers yet"}
            description={
              isFiltered
                ? "Try a different search or clear the filters."
                : "Add the first customer to get started."
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Customer",
            cell: (row) => (
              <div className="flex flex-col">
                <Link
                  href={`/customers/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
                {row.title && (
                  <span className="text-xs text-muted-foreground">
                    {row.title}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "company",
            header: "Company",
            cell: (row) => (
              <div className="flex flex-col">
                <span>{row.companyName}</span>
                <span className="text-xs text-muted-foreground">
                  {CompanyTypeLabel[row.companyType]}
                </span>
              </div>
            ),
          },
          {
            key: "mobile",
            header: "Mobile",
            cell: (row) => (
              <span className="font-mono whitespace-nowrap tabular-nums">
                {formatMobile(row.mobile)}
              </span>
            ),
          },
          {
            key: "owners",
            header: "Owners",
            cell: (row) => row.ownerNames.join(" + ") || "–",
          },
          {
            key: "rating",
            header: "Rating",
            cell: (row) => (
              <StatusBadge tone={ratingTone[row.rating] ?? "neutral"}>
                {row.rating} · {RatingLabel[row.rating]}
              </StatusBadge>
            ),
          },
          {
            key: "account",
            header: "Account type",
            cell: (row) => AccountTypeLabel[row.accountType],
          },
          {
            key: "health",
            header: "Activity",
            cell: (row) => <CustomerHealthBadge health={row.health} />,
          },
          {
            key: "edit",
            header: "",
            cell: (row) => {
              if (row.canEdit) {
                return (
                  <ContactDialog
                    contact={row.editable}
                    companies={companies}
                    team={team}
                    canSetAccountType={canSetAccountType(me.jobRole)}
                    canRequestOwnership={false}
                  />
                );
              }
              if (!row.canRequest) return null;
              return row.requested ? (
                <StatusBadge tone="warn">Requested</StatusBadge>
              ) : (
                <RequestOwnershipDialog
                  contactId={row.id}
                  customerName={row.name}
                  ownerNames={row.ownerNames}
                />
              );
            },
          },
        ]}
      />
    </div>
  );
}
