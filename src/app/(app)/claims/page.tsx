import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { pageLabel } from "@/lib/auth/pages";
import { requirePage } from "@/lib/auth/require-page";
import { canFileClaim, canManageClaims } from "@/lib/domain/claim-eligibility";
import { getT } from "@/lib/i18n/server-t";
import { AllClaims } from "./all-claims";
import { loadClaimSettings } from "./claim-settings-data";
import { ClaimTabs } from "./claim-tabs";
import { MyTravelClaim } from "./my-travel-claim";
import { OvertimeToDecide } from "./overtime-to-decide";

export const metadata: Metadata = { title: "Claims" };

const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const claimParam = z.uuid();
const viewParam = z.enum(["all", "mine"]).catch("all");

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("claims");
  const t = await getT(me.language);
  // Only the MD and HR & Accounts see a claims list; everyone else, directors included, has their own claim.
  const title = t(pageLabel("claims", me));
  const settings = await loadClaimSettings();
  const search = await searchParams;
  const asked = monthParam.safeParse(search.month);
  const requestedMonth = asked.success ? `${asked.data}-01` : null;

  if (!canManageClaims(me.jobRole)) {
    return (
      <div className="flex flex-col gap-4 print:[&>:not([data-print-sheet])]:hidden">
        <PageHeader
          title={title}
          description={`${t("One summary per month. Fill in the monthly totals, print the claim form, attach all the receipts and hand it to Jany. Jany releases the claim once the monthly report for that month has been submitted. Commission is claimed separately on the Commission page.")} ${t("Cut-off day")}: ${settings.cutOffDay}.`}
        />
        <OvertimeToDecide me={me} t={t} />
        <MyTravelClaim
          me={me}
          cutOffDay={settings.cutOffDay}
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
  ];

  return (
    <div className="flex flex-col gap-4 print:[&>:not([data-print-sheet])]:hidden">
      <PageHeader
        title={title}
        description={`${t("Staff fill in one summary per month and hand the printed form with receipts to Jany. Tap a name to check it, tick Vicky's OK and release. Release unlocks once that person's monthly report is submitted.")} ${t("Cut-off day")}: ${settings.cutOffDay}.`}
      />
      <ClaimTabs tabs={tabs} active={view} label={t("Claims views")} />
      {view === "all" && (
        <>
          <OvertimeToDecide me={me} t={t} />
          <AllClaims
            cutOffDay={settings.cutOffDay}
            requestedMonth={requestedMonth}
            openClaimId={claimParam.safeParse(search.claim).data ?? null}
            t={t}
          />
        </>
      )}
      {view === "mine" && (
        <MyTravelClaim
          me={me}
          cutOffDay={settings.cutOffDay}
          requestedMonth={requestedMonth}
          hrefFor={(month) => `/claims?view=mine&month=${month}`}
          t={t}
        />
      )}
    </div>
  );
}
