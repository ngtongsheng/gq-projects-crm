import { Building2, Search } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
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
import type { TeamMember } from "@/lib/auth/team-directory";
import { formatDate } from "@/lib/format/date";
import { loadCompanies } from "./company-data";
import {
  type CompanyFilters,
  type CompanyRow,
  filterCompanies,
} from "./company-rows";
import { type CompanyStatus, companyStatusLabel } from "./company-status";
import {
  AccountTypeLabel,
  CompanyType,
  CompanyTypeLabel,
  RatingLabel,
} from "./schemas";

const ALL = "all";

const statusTone: Record<CompanyStatus["kind"], StatusTone> = {
  none: "neutral",
  active: "good",
  quiet: "warn",
  no_visit: "bad",
};

const SHOWN_PEOPLE = 3;
const SHOWN_SALESPEOPLE = 2;

const peopleSummary = (row: CompanyRow) => {
  const names = row.people.slice(0, SHOWN_PEOPLE).map((person) => person.name);
  const more = row.people.length - SHOWN_PEOPLE;
  return more > 0 ? `${names.join(", ")} +${more}` : names.join(", ");
};

/** The "Companies" view: one row per company with its type, salespeople and last visit. */
export async function CompaniesTable({
  filters,
  team,
  canFilterByOwner,
}: {
  filters: CompanyFilters;
  team: TeamMember[];
  canFilterByOwner: boolean;
}) {
  const rows = filterCompanies(await loadCompanies(), filters);
  const peopleCount = rows.reduce((total, row) => total + row.people.length, 0);
  const isFiltered =
    filters.q !== "" ||
    filters.owner !== undefined ||
    filters.type !== undefined ||
    filters.status !== undefined;

  return (
    <>
      <form action="/customers" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          type="search"
          aria-label="Search companies"
          placeholder="Search company or person"
          defaultValue={filters.q}
          className="w-full sm:w-64"
        />
        {canFilterByOwner && (
          <Select name="owner" defaultValue={filters.owner ?? ALL}>
            <SelectTrigger aria-label="Salesperson" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              {team.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select name="type" defaultValue={filters.type ?? ALL}>
          <SelectTrigger aria-label="Company type" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {CompanyType.options.map((type) => (
              <SelectItem key={type} value={type}>
                {CompanyTypeLabel[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="status" defaultValue={filters.status ?? ALL}>
          <SelectTrigger aria-label="Status" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All status</SelectItem>
            <SelectItem value="quiet">Quiet 60+ days</SelectItem>
            <SelectItem value="inactive">No visit 90+ days</SelectItem>
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
      <p className="text-sm text-muted-foreground">
        {rows.length} companies · {peopleCount} people
      </p>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Building2}
            title={isFiltered ? "No companies match" : "No companies yet"}
            description={
              isFiltered
                ? "Try a different search or clear the filters."
                : "Add the first customer to get started."
            }
          />
        }
        columns={[
          {
            key: "company",
            header: "Company",
            cell: (row) => (
              <div className="flex flex-col">
                <Link
                  href={`/customers?company=${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {peopleSummary(row)}
                </span>
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            cell: (row) => (
              <div className="flex flex-col">
                <span>{CompanyTypeLabel[row.companyType]}</span>
                <span className="text-xs text-muted-foreground">
                  {row.rating} · {RatingLabel[row.rating]}
                  {row.accountType && ` · ${AccountTypeLabel[row.accountType]}`}
                </span>
              </div>
            ),
          },
          {
            key: "salespeople",
            header: "Salespeople",
            cell: (row) =>
              row.salespeople
                .slice(0, SHOWN_SALESPEOPLE)
                .map((person) => person.name)
                .join(" + ") || "–",
          },
          {
            key: "people",
            header: "People",
            numeric: true,
            cell: (row) => row.people.length,
          },
          {
            key: "lastVisit",
            header: "Last visit",
            className: "max-sm:hidden",
            cell: (row) => (row.lastVisit ? formatDate(row.lastVisit) : "–"),
          },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <StatusBadge tone={statusTone[row.status.kind]}>
                {companyStatusLabel(row.status)}
              </StatusBadge>
            ),
          },
        ]}
      />
    </>
  );
}
