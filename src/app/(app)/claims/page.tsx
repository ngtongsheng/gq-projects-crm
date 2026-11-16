import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { pageLabel } from "@/lib/auth/pages";
import { requirePage } from "@/lib/auth/require-page";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { canManageClaims } from "@/lib/domain/claim-flow";
import { getT } from "@/lib/i18n/server-t";
import { AllClaims } from "./all-claims";
import { loadClaimSettings } from "./claim-settings-data";
import { ClaimSettingsForm } from "./claim-settings-form";
import { ClaimTabs } from "./claim-tabs";
import { MyClaimsView } from "./my-claims-view";

export const metadata: Metadata = { title: "Claims" };

const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const viewParam = z.enum(["all", "mine", "settings"]).catch("all");

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("claims");
  const t = await getT(me.language);
  const title = t(pageLabel("claims", me));
  const settings = await loadClaimSettings();
  const search = await searchParams;
  const asked = monthParam.safeParse(search.month);
  const requestedMonth = asked.success ? `${asked.data}-01` : null;

  if (!canManageClaims(me.jobRole)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={title}
          description={`${t("One claim a month for commission, travelling expense and overtime. Submit by day")} ${settings.cutOffDay}. ${t("Expenses dated after that go into next month's claim.")}`}
        />
        <MyClaimsView
          me={me}
          settings={settings}
          requestedMonth={requestedMonth}
          hrefFor={(month) => `/claims?month=${month}`}
          t={t}
        />
      </div>
    );
  }

  // The MD and HR & Accounts settle claims; they have a claim of their own only when their role files one.
  const files = canFileClaim(me);
  const asView = viewParam.parse(search.view);
  const view = asView === "mine" && !files ? "all" : asView;
  const tabs = [
    { id: "all", label: t("All claims"), href: "/claims?view=all" },
    ...(files
      ? [{ id: "mine", label: t("My claim"), href: "/claims?view=mine" }]
      : []),
    { id: "settings", label: t("Settings"), href: "/claims?view=settings" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={t(
          "Check, approve and pay the monthly claims for commission, travelling expense and overtime.",
        )}
      />
      <ClaimTabs tabs={tabs} active={view} label={t("Claims views")} />
      {view === "all" && (
        <AllClaims
          me={me}
          settings={settings}
          requestedMonth={requestedMonth}
          t={t}
        />
      )}
      {view === "mine" && (
        <MyClaimsView
          me={me}
          settings={settings}
          requestedMonth={requestedMonth}
          hrefFor={(month) => `/claims?view=mine&month=${month}`}
          t={t}
        />
      )}
      {view === "settings" && (
        <ClaimSettingsForm
          settings={settings}
          canSetLateCuts={me.jobRole === "md"}
        />
      )}
    </div>
  );
}
