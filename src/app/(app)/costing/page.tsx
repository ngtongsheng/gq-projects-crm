import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canStartQuote, canWorkEnquiries } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { loadQuoteRegister } from "./quote-data";
import { QuoteStatusLabel } from "./quote-status";
import { QuoteStatus } from "./quote-view";
import {
  applyRegisterFilters,
  parseRegisterFilters,
  RegisterSort,
  RegisterSortLabel,
} from "./register-filters";
import { RegisterTable } from "./register-table";

export const metadata: Metadata = { title: "Costing" };

const ALL = "all";

export default async function CostingRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("cost");
  const filters = parseRegisterFilters(await searchParams);
  const canStart = canStartQuote(me.jobRole);
  const rows = applyRegisterFilters(await loadQuoteRegister(me), filters);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Costing Register"
        description="Find every version by Quotation No."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/costing/approvals">Below min margin</Link>
            </Button>
            {canWorkEnquiries(me.jobRole) && (
              <Button asChild variant="outline">
                <Link href="/costing/enquiries">FOB Enquiry</Link>
              </Button>
            )}
            {canStart && (
              <Button asChild>
                <Link href="/costing/new">
                  <Plus data-icon="inline-start" />
                  New costing
                </Link>
              </Button>
            )}
          </>
        }
      />
      <form action="/costing" className="flex flex-wrap items-center gap-2">
        <Input
          name="search"
          aria-label="Search"
          placeholder="Search quotation no., project, customer"
          defaultValue={filters.search}
          maxLength={100}
          className="w-full sm:w-80"
        />
        <Select name="status" defaultValue={filters.status ?? ALL}>
          <SelectTrigger aria-label="Status" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {QuoteStatus.options.map((status) => (
              <SelectItem key={status} value={status}>
                {QuoteStatusLabel[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="sort" defaultValue={filters.sort}>
          <SelectTrigger aria-label="Sort" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RegisterSort.options.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {RegisterSortLabel[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Filter
        </Button>
        <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
          {rows.length} costings
        </span>
      </form>
      <RegisterTable
        rows={rows}
        filtered={filters.search !== undefined || filters.status !== undefined}
        canStart={canStart}
      />
    </div>
  );
}
