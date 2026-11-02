import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  type AttentionKey,
  attentionItems,
  attentionKeysFor,
} from "@/lib/domain/attention";
import { salespersonRows, salesTotals } from "@/lib/domain/order-rollup";
import { achievedTone } from "@/lib/domain/report-stats";
import { pace as monthPace } from "@/lib/domain/workdays";
import { todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { canDecideOwnership } from "../customers/ownership/ownership-access";
import { countPendingOwnershipRequests } from "../customers/ownership/pending-count";
import { loadOtClaims } from "../overtime/overtime-data";
import { ProjectStageLabel } from "../projects/schemas";
import {
  loadActiveSites,
  loadPendingClaims,
} from "../site-work/site-work-data";
import { loadInactiveCustomerOwners } from "./customer-data";
import { loadDashboardOrders } from "./dashboard-orders";
import {
  AttentionPanel,
  PaceBar,
  Panel,
  PanelEmpty,
  StatTile,
  TableSection,
  TileGrid,
} from "./dashboard-parts";
import { loadOpenProjects } from "./pipeline-data";
import { loadPurchasingFacts } from "./purchasing-data";
import { loadTeamSnapshot, type TeamRow } from "./report-snapshot";

/** The team's month for the MD, Sales Director and HR & Accounts: pace against targets and what is slipping. */
export async function ManagerDashboard({ me }: { me: Profile }) {
  const today = todayMyt();
  const wants = (key: AttentionKey) =>
    attentionKeysFor(me.jobRole).includes(key);
  const [team, projects, orders, inactiveOwners, names] = await Promise.all([
    loadTeamSnapshot(today),
    loadOpenProjects(today),
    loadDashboardOrders(),
    loadInactiveCustomerOwners(today),
    getTeamDirectory(),
  ]);
  const [requests, overtime, sites, claims, purchasing] = await Promise.all([
    wants("ownershipRequests") && canDecideOwnership(me.jobRole)
      ? countPendingOwnershipRequests()
      : 0,
    wants("pendingOvertime") ? loadOtClaims() : [],
    wants("overdueFollowUps") ? loadActiveSites(today) : [],
    wants("claimsToVerify") ? loadPendingClaims(me) : [],
    wants("overdueSupplierPos") ? loadPurchasingFacts(today) : null,
  ]);
  const nameOf = new Map(names.map((member) => [member.id, member.name]));
  const paceNow = monthPace(today);

  const visits = team.rows.reduce((total, row) => total + row.stats.visits, 0);
  const visitTarget = team.rows.reduce(
    (total, row) => total + row.stats.visitTarget,
    0,
  );
  const newCustomers = team.rows.reduce(
    (total, row) => total + row.stats.newCustomers,
    0,
  );
  const totals = salesTotals(orders, today);
  const unpaid = orders.filter((order) => order.outstanding > 0);
  const stale = projects.filter((project) => project.stale);
  const overdue = projects.filter((project) => project.overdue);
  const chase = projects
    .filter((project) => project.overdue || project.stale)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const bySalesperson = new Map(
    salespersonRows(orders, today).map((row) => [row.personId, row]),
  );

  const attention = attentionItems(me.jobRole, {
    ownershipRequests: requests,
    lateReports: team.lateReports,
    overdueProjects: overdue.length,
    staleProjects: stale.length,
    inactiveCustomers: inactiveOwners.length,
    pendingOvertime: overtime.filter(
      (claim) => claim.status === "pending" && claim.profileId !== me.id,
    ).length,
    overdueFollowUps: sites.reduce(
      (total, site) => total + site.overdueFollowUps,
      0,
    ),
    claimsToVerify: claims.length,
    overdueSupplierPos: purchasing?.overduePos,
    missingSupplierPos: purchasing?.missingPos,
    unsignedDos: purchasing?.unsignedDos,
  });

  return (
    <div className="flex flex-col gap-4">
      <AttentionPanel items={attention} />
      <TileGrid>
        <StatTile label="Team visits this month" value={visits}>
          <PaceBar
            done={visits}
            target={visitTarget}
            pace={paceNow}
            label="Team visits against target"
          />
        </StatTile>
        <StatTile
          label="New customers this month"
          value={newCustomers}
          note="First completed visit this month"
        />
        <StatTile
          label="Open pipeline"
          value={formatRm(sumRm(projects.map((project) => project.value)))}
          note={`${projects.length} projects · ${stale.length} not updated in 14+ days`}
        />
        <StatTile
          label="Awarded this month"
          value={formatRm(totals.month.value)}
          note={`${totals.month.count} ${totals.month.count === 1 ? "order" : "orders"}`}
        />
        <StatTile
          label="Sales this year"
          value={formatRm(totals.year.value)}
          note={`${totals.year.count} orders`}
        />
        <StatTile
          label="Payment outstanding"
          value={formatRm(sumRm(unpaid.map((order) => order.outstanding)))}
          note={`${unpaid.length} orders not fully paid`}
        />
      </TileGrid>
      <TableSection
        title="By salesperson"
        aside={`Month pace: ${Math.round(paceNow * 100)}% of working days gone`}
      >
        <TeamTable
          rows={team.rows}
          pace={paceNow}
          context={{ bySalesperson, projects, inactiveOwners }}
        />
      </TableSection>
      <Panel
        title="Projects to chase"
        aside={
          <Link href="/projects" className="hover:underline">
            Open Projects
          </Link>
        }
      >
        {chase.length === 0 ? (
          <PanelEmpty>
            Every open project has a next action date ahead and was updated in
            the last 14 days.
          </PanelEmpty>
        ) : (
          <ul className="divide-y">
            {chase.slice(0, 8).map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {nameOf.get(project.picId) ?? "Unnamed"} ·{" "}
                    {project.companyName} · {ProjectStageLabel[project.stage]}
                  </p>
                </div>
                {project.overdue ? (
                  <StatusBadge tone="bad">Past next action date</StatusBadge>
                ) : null}
                {project.stale ? (
                  <StatusBadge tone="warn">No update in 14+ days</StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

type TableContext = {
  bySalesperson: Map<string, ReturnType<typeof salespersonRows>[number]>;
  projects: Awaited<ReturnType<typeof loadOpenProjects>>;
  inactiveOwners: string[][];
};

function TeamTable({
  rows,
  pace,
  context,
}: {
  rows: TeamRow[];
  pace: number;
  context: TableContext;
}) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      empty={<PanelEmpty>No one files a sales report yet.</PanelEmpty>}
      columns={[
        {
          key: "name",
          header: "Name",
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        {
          key: "visits",
          header: "Visits / target",
          numeric: true,
          cell: (row) => (
            <span className="inline-flex items-center justify-end gap-2">
              {row.stats.visits} / {row.stats.visitTarget}
              {row.stats.visitTarget > 0 && (
                <StatusBadge
                  tone={achievedTone(
                    row.stats.visits,
                    row.stats.visitTarget,
                    pace,
                  )}
                >
                  {Math.round((row.stats.visits / row.stats.visitTarget) * 100)}
                  %
                </StatusBadge>
              )}
            </span>
          ),
        },
        {
          key: "yearSales",
          header: "Sales this year",
          numeric: true,
          cell: (row) =>
            formatRm(context.bySalesperson.get(row.id)?.yearValue ?? 0),
        },
        {
          key: "newCustomers",
          header: "New",
          numeric: true,
          cell: (row) => row.stats.newCustomers,
        },
        {
          key: "openProjects",
          header: "Open projects",
          numeric: true,
          cell: (row) =>
            context.projects.filter((project) => project.picId === row.id)
              .length,
        },
        {
          key: "inactive",
          header: "No activity 90d+",
          numeric: true,
          cell: (row) => {
            const count = context.inactiveOwners.filter((owners) =>
              owners.includes(row.id),
            ).length;
            return count > 0 ? (
              <StatusBadge tone="bad">{count}</StatusBadge>
            ) : (
              0
            );
          },
        },
        {
          key: "report",
          header: "Last month's report",
          cell: (row) => (
            <StatusBadge tone={row.lastReport.tone}>
              {row.lastReport.label}
            </StatusBadge>
          ),
        },
      ]}
    />
  );
}
