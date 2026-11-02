import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { JobRole } from "@/lib/auth/job-role";
import { requireRole } from "@/lib/auth/require-role";
import { workdaysElapsed, workdaysInMonth } from "@/lib/domain/workdays";
import { formatDate, todayMyt } from "@/lib/format/date";
import { ManagerDashboard } from "./dashboard/manager-dashboard";
import { SalesDashboard } from "./dashboard/sales-dashboard";
import { SiteDashboard } from "./dashboard/site-dashboard";
import { SupportDashboard } from "./dashboard/support-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

const viewParam = z.enum(["sales", "mof"]).catch("sales");

/** The MD and HR & Accounts switch between sales activity and the MOF and projects view. */
const hasViewToggle = (jobRole: JobRole) =>
  jobRole === "md" || jobRole === "accounts";

const TITLE: Record<JobRole, string> = {
  md: "Team dashboard",
  director: "Team dashboard",
  accounts: "Team dashboard",
  bd: "My dashboard",
  sales: "My dashboard",
  support: "MOF dashboard",
  site: "My dashboard",
};

/**
 * Home for every job role, including the Site Supervisor, who has no Dashboard entry in the
 * sidebar. Each role gets its own view; the database decides what each one can read.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireRole("staff");
  const view = hasViewToggle(me.jobRole)
    ? viewParam.parse((await searchParams).view)
    : "sales";
  const today = todayMyt();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          view === "mof" && hasViewToggle(me.jobRole)
            ? "MOF dashboard"
            : TITLE[me.jobRole]
        }
        description={`${formatDate(today)} · working day ${workdaysElapsed(today)} of ${workdaysInMonth(today)}`}
        actions={
          hasViewToggle(me.jobRole) ? (
            <nav aria-label="Dashboard view" className="flex gap-1">
              {(
                [
                  ["sales", "Sales activity"],
                  ["mof", "MOF and projects"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  asChild
                  size="sm"
                  variant={view === key ? "secondary" : "ghost"}
                >
                  <Link
                    href={`/?view=${key}`}
                    aria-current={view === key ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>
          ) : undefined
        }
      />
      {view === "mof" || me.jobRole === "support" ? (
        <SupportDashboard me={me} />
      ) : me.jobRole === "site" ? (
        <SiteDashboard me={me} />
      ) : me.jobRole === "sales" || me.jobRole === "bd" ? (
        <SalesDashboard me={me} />
      ) : (
        <ManagerDashboard me={me} />
      )}
    </div>
  );
}
