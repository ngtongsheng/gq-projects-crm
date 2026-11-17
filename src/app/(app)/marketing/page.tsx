import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { getT } from "@/lib/i18n/server-t";
import { SegmentLinks } from "../site-work/segment-links";
import { editsMarketing } from "./marketing-access";
import { MarketingCategoriesDialog } from "./marketing-categories-dialog";
import {
  loadEventOptions,
  loadMarketingCategories,
  loadMarketingExpenses,
  loadVendorNames,
} from "./marketing-data";
import { MarketingExpenseLog } from "./marketing-expense-log";
import type { MarketingCategory } from "./marketing-types";
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
  const view = viewParam.parse((await searchParams).view);
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
      {view === "expenses" ? (
        <ExpenseLogView categories={categories} canEdit={canEdit} />
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

async function ExpenseLogView({
  categories,
  canEdit,
}: {
  categories: MarketingCategory[];
  canEdit: boolean;
}) {
  const [expenses, events, vendors] = await Promise.all([
    loadMarketingExpenses(),
    canEdit ? loadEventOptions() : [],
    canEdit ? loadVendorNames() : [],
  ]);
  return (
    <MarketingExpenseLog
      expenses={expenses}
      categories={categories}
      events={events}
      vendors={vendors}
      canEdit={canEdit}
    />
  );
}
