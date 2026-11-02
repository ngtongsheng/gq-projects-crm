import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
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
import {
  canAddContact,
  canEditContact,
  canSetAccountType,
} from "./contact-access";
import { ContactDialog } from "./contact-form";
import { filterCustomers, parseCustomerFilters } from "./customer-filters";
import {
  AccountType,
  AccountTypeLabel,
  CompanyType,
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

const contactRows = z.array(
  z.object({
    id: z.string(),
    company_id: z.string(),
    name: z.string(),
    mobile: z.string(),
    title: z.string().nullable(),
    rating: z.number().int(),
    account_type: AccountType,
    passed_by: z.string().nullable(),
    notes: z.string().nullable(),
    companies: z.object({ name: z.string(), company_type: CompanyType }),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

const companyRows = z.array(z.object({ id: z.string(), name: z.string() }));

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("customers");
  const filters = parseCustomerFilters(await searchParams);
  const supabase = await createClient();

  const [contactsResult, companiesResult, team] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, company_id, name, mobile, title, rating, account_type, passed_by, notes, companies(name, company_type), contact_owners(profile_id)",
      )
      .is("archived_at", null)
      .order("name"),
    supabase.from("companies").select("id, name").order("name"),
    getTeamDirectory(),
  ]);
  if (contactsResult.error) {
    throw new Error(
      `Could not load customers: ${contactsResult.error.message}`,
    );
  }
  if (companiesResult.error) {
    throw new Error(
      `Could not load companies: ${companiesResult.error.message}`,
    );
  }
  const companies = companyRows.parse(companiesResult.data);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const customers = contactRows.parse(contactsResult.data).map((row) => {
    const ownerIds = row.contact_owners.map((owner) => owner.profile_id);
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      mobile: row.mobile,
      companyName: row.companies.name,
      companyType: row.companies.company_type,
      rating: row.rating,
      accountType: row.account_type,
      ownerIds,
      ownerNames: ownerIds.map((id) => nameOf.get(id) ?? "Unnamed"),
      editable: {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        mobile: formatMobile(row.mobile),
        title: row.title ?? "",
        rating: row.rating,
        accountType: row.account_type,
        passedBy: row.passed_by ?? "",
        notes: row.notes ?? "",
      },
      canEdit: canEditContact(me.jobRole, ownerIds.includes(me.id)),
    };
  });
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
          canAddContact(me.jobRole) ? (
            <ContactDialog
              companies={companies}
              team={team}
              canSetAccountType={canSetAccountType(me.jobRole)}
            />
          ) : undefined
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
                <span className="font-medium">{row.name}</span>
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
            key: "edit",
            header: "",
            cell: (row) =>
              row.canEdit ? (
                <ContactDialog
                  contact={row.editable}
                  companies={companies}
                  team={team}
                  canSetAccountType={canSetAccountType(me.jobRole)}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
