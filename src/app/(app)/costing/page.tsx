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
import { getT } from "@/lib/i18n/server-t";
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
  const t = await getT(me.language);
  const filters = parseRegisterFilters(await searchParams);
  const canStart = canStartQuote(me.jobRole);
  const rows = applyRegisterFilters(await loadQuoteRegister(me), filters);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Costing Register")}
        description={t("Find every version by Quotation No.")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/costing/approvals">{t("Below min margin")}</Link>
            </Button>
            {canWorkEnquiries(me.jobRole) && (
              <Button asChild variant="outline">
                <Link href="/costing/enquiries">{t("FOB Enquiry")}</Link>
              </Button>
            )}
            {canStart && (
              <Button asChild>
                <Link href="/costing/new">
                  <Plus data-icon="inline-start" />
                  {t("New costing")}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <form action="/costing" className="flex flex-wrap items-center gap-2">
        <Input
          name="search"
          aria-label={t("Search")}
          placeholder={t("Search quotation no., project, customer")}
          defaultValue={filters.search}
          maxLength={100}
          className="w-full sm:w-80"
        />
        <Select name="status" defaultValue={filters.status ?? ALL}>
          <SelectTrigger aria-label={t("Status")} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("All statuses")}</SelectItem>
            {QuoteStatus.options.map((status) => (
              <SelectItem key={status} value={status}>
                {t(QuoteStatusLabel[status])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="sort" defaultValue={filters.sort}>
          <SelectTrigger aria-label={t("Sort")} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RegisterSort.options.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {t(RegisterSortLabel[sort])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          {t("Filter")}
        </Button>
        <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
          {rows.length} {t("costings")}
        </span>
      </form>
      <RegisterTable
        rows={rows}
        filtered={filters.search !== undefined || filters.status !== undefined}
        canStart={canStart}
        t={t}
      />
    </div>
  );
}
