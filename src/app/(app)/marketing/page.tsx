import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import type { Translate } from "@/lib/i18n/translate";
import { loadCustomerNames } from "../customers/company-data";
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
import { loadMarketingEvents } from "./marketing-events-data";
import { MarketingEventsView } from "./marketing-events-view";
import {
  type ExpenseFilters,
  expenseFiltersFromParams,
} from "./marketing-expense-filters";
import { MarketingExpenseLog } from "./marketing-expense-log";
import { loadGiveaways } from "./marketing-giveaway-data";
import { MarketingGiveawayView } from "./marketing-giveaway-view";
import {
  loadPrepaidAccounts,
  loadPrepaidEntries,
} from "./marketing-prepaid-data";
import { MarketingPrepaidView } from "./marketing-prepaid-view";
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
    // The Events tab prints its costing sheet; everything else on the page stays off the paper.
    <div className="flex flex-col gap-4 print:[&>:not([data-print-sheet])]:hidden">
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
      ) : view === "events" ? (
        <EventsView
          params={params}
          categories={categories}
          canEdit={canEdit}
          printedBy={me.fullName ?? "Unnamed"}
        />
      ) : view === "prepaid" ? (
        <PrepaidView
          params={params}
          canEdit={canEdit}
          printedBy={me.fullName ?? "Unnamed"}
        />
      ) : (
        <GiveawayView canEdit={canEdit} />
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
  const [expenses, eventCosts, prepaidAccounts] = await Promise.all([
    loadMarketingExpenses(),
    loadEventCosts(),
    loadPrepaidAccounts(),
  ]);
  return (
    <MarketingDashboardView
      expenses={expenses}
      categories={categories}
      eventCosts={eventCostRows(eventCosts)}
      prepaidAccounts={prepaidAccounts}
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

const eventParam = z.uuid();
const vendorParam = z.uuid();

async function EventsView({
  params,
  categories,
  canEdit,
  printedBy,
}: {
  params: Record<string, string | string[] | undefined>;
  categories: MarketingCategory[];
  canEdit: boolean;
  printedBy: string;
}) {
  const [events, expenses, vendors] = await Promise.all([
    loadMarketingEvents(),
    loadMarketingExpenses(),
    canEdit ? loadVendorNames() : [],
  ]);
  const initialEventId = eventParam.safeParse(params.event).data ?? null;
  return (
    <MarketingEventsView
      // A new link from the dashboard opens that event.
      key={initialEventId}
      events={events}
      expenses={expenses}
      categories={categories}
      vendors={vendors}
      initialEventId={initialEventId}
      canEdit={canEdit}
      today={todayMyt()}
      printedBy={printedBy}
    />
  );
}

async function PrepaidView({
  params,
  canEdit,
  printedBy,
}: {
  params: Record<string, string | string[] | undefined>;
  canEdit: boolean;
  printedBy: string;
}) {
  const [accounts, entries, vendors] = await Promise.all([
    loadPrepaidAccounts(),
    loadPrepaidEntries(),
    canEdit ? loadVendorNames() : [],
  ]);
  const initialVendorId = vendorParam.safeParse(params.vendor).data ?? null;
  return (
    <MarketingPrepaidView
      // A new link from a dashboard banner opens that account.
      key={initialVendorId}
      accounts={accounts}
      entries={entries}
      vendors={vendors}
      initialVendorId={initialVendorId}
      canEdit={canEdit}
      today={todayMyt()}
      printedBy={printedBy}
    />
  );
}

async function GiveawayView({ canEdit }: { canEdit: boolean }) {
  const [giveaways, customers] = await Promise.all([
    loadGiveaways(),
    canEdit ? loadCustomerNames() : [],
  ]);
  return (
    <MarketingGiveawayView
      giveaways={giveaways}
      customers={customers}
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
