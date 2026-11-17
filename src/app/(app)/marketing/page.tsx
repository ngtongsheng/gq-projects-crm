import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import type { Translate } from "@/lib/i18n/translate";
import { SegmentLinks } from "../site-work/segment-links";
import { editsMarketing } from "./marketing-access";
import { MarketingCategoriesDialog } from "./marketing-categories-dialog";
import { eventCostRows } from "./marketing-dashboard";
import { MarketingDashboardView } from "./marketing-dashboard-view";
import {
  loadEventCosts,
  loadEventOptions,
  loadMarketingCategories,
  loadMarketingExpenses,
  loadMarketingVendors,
  loadVendorNames,
} from "./marketing-data";
import {
  type ExpenseFilters,
  expenseFiltersFromParams,
} from "./marketing-expense-filters";
import { MarketingExpenseLog } from "./marketing-expense-log";
import type { MarketingCategory } from "./marketing-types";
import { MarketingVendorsView } from "./marketing-vendors-view";
import { MARKETING_VIEW_LABEL, MARKETING_VIEWS } from "./marketing-views";

export const metadata: Metadata = { title: "Marketing expense" };

const viewParam = z.enum(MARKETING_VIEWS).catch("dashboard");

/** What the marketing team spends and where it goes (demo vMkt). Accounts looks but does not change. */
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("mkt");
  const t = await getT(me.language);
  const params = await searchParams;
  const view = viewParam.parse(params.view);
  const canEdit = editsMarketing(me.jobRole);
  const categories = await loadMarketingCategories();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Marketing expense")}
        description={t(
          "Everything the marketing team spends, by category and month.",
        )}
        actions={
          canEdit && <MarketingCategoriesDialog categories={categories} />
        }
      />
      <SegmentLinks
        label={t("Marketing views")}
        active={view}
        items={MARKETING_VIEWS.map((key) => ({
          key,
          label: t(MARKETING_VIEW_LABEL[key]),
          href: `/marketing?view=${key}`,
        }))}
      />
      {view === "dashboard" ? (
        <DashboardView params={params} categories={categories} t={t} />
      ) : view === "expenses" ? (
        <ExpenseLogView
          categories={categories}
          canEdit={canEdit}
          filters={expenseFiltersFromParams(
            params,
            new Set(categories.map((category) => category.id)),
          )}
        />
      ) : view === "vendors" ? (
        <VendorsView params={params} canEdit={canEdit} />
      ) : (
        <EmptyState
          icon={Wallet}
          title={t(MARKETING_VIEW_LABEL[view])}
          description={t("Nothing here yet.")}
        />
      )}
    </div>
  );
}

const yearParam = z.string().regex(/^\d{4}$/);

async function DashboardView({
  params,
  categories,
  t,
}: {
  params: Record<string, string | string[] | undefined>;
  categories: MarketingCategory[];
  t: Translate;
}) {
  const today = todayMyt();
  const [expenses, eventCosts] = await Promise.all([
    loadMarketingExpenses(),
    loadEventCosts(),
  ]);
  return (
    <MarketingDashboardView
      expenses={expenses}
      categories={categories}
      eventCosts={eventCostRows(eventCosts)}
      year={yearParam.catch(today.slice(0, 4)).parse(params.year)}
      showAllVendors={params.vendors === "all"}
      today={today}
      t={t}
    />
  );
}

async function VendorsView({
  params,
  canEdit,
}: {
  params: Record<string, string | string[] | undefined>;
  canEdit: boolean;
}) {
  const today = todayMyt();
  return (
    <MarketingVendorsView
      vendors={await loadMarketingVendors()}
      year={yearParam.catch(today.slice(0, 4)).parse(params.year)}
      today={today}
      canEdit={canEdit}
    />
  );
}

async function ExpenseLogView({
  categories,
  canEdit,
  filters,
}: {
  categories: MarketingCategory[];
  canEdit: boolean;
  filters: ExpenseFilters;
}) {
  const [expenses, events, vendors] = await Promise.all([
    loadMarketingExpenses(),
    canEdit ? loadEventOptions() : [],
    canEdit ? loadVendorNames() : [],
  ]);
  return (
    <MarketingExpenseLog
      // A new link from the dashboard starts the log again with its filters.
      key={`${filters.month}|${filters.categoryId}|${filters.query}`}
      initialFilters={filters}
      expenses={expenses}
      categories={categories}
      events={events}
      vendors={vendors}
      canEdit={canEdit}
    />
  );
}
