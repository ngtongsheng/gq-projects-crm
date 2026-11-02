import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { attentionItems } from "@/lib/domain/attention";
import { salesTotals, yearPace } from "@/lib/domain/order-rollup";
import { pace as monthPace } from "@/lib/domain/workdays";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { ProjectStageLabel } from "../projects/schemas";
import { loadInactiveCustomerOwners } from "./customer-data";
import { loadDashboardOrders } from "./dashboard-orders";
import {
  AttentionPanel,
  PaceBar,
  Panel,
  PanelEmpty,
  StatTile,
  TileGrid,
} from "./dashboard-parts";
import { loadOpenProjects, projectsOf } from "./pipeline-data";
import { loadOwnMonth } from "./report-snapshot";

/** A salesperson's or BD Director's own month: visits, sales and pace, and the deals to chase. */
export async function SalesDashboard({ me }: { me: Profile }) {
  const today = todayMyt();
  const [own, projects, orders, inactiveOwners] = await Promise.all([
    loadOwnMonth(me, today),
    loadOpenProjects(today),
    loadDashboardOrders(),
    loadInactiveCustomerOwners(today),
  ]);
  const stats = own?.stats.kind === "site" ? null : (own?.stats ?? null);
  const mine = projectsOf(projects, me.id);
  const chase = mine
    .filter((project) => project.overdue || project.stale)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const myOrders = orders.filter((order) => order.salespersonId === me.id);
  const totals = salesTotals(myOrders, today);
  const owed = sumRm(
    orders
      .filter(
        (order) =>
          order.salespersonId === me.id || order.secondSalespersonId === me.id,
      )
      .map((order) => order.outstanding),
  );
  const paceNow = monthPace(today);

  const attention = attentionItems(me.jobRole, {
    ownReport: own?.reportOverdue ? 1 : 0,
    overdueProjects: mine.filter((project) => project.overdue).length,
    staleProjects: mine.filter((project) => project.stale).length,
    inactiveCustomers: inactiveOwners.filter((owners) => owners.includes(me.id))
      .length,
  });

  return (
    <div className="flex flex-col gap-4">
      <AttentionPanel items={attention} />
      <TileGrid>
        {stats ? (
          <StatTile label="Customer visits this month" value={stats.visits}>
            <PaceBar
              done={stats.visits}
              target={stats.visitTarget}
              pace={paceNow}
              label="Customer visits against target"
            />
          </StatTile>
        ) : null}
        {stats ? (
          <StatTile
            label="New customers met"
            value={stats.newCustomers}
            note="First completed visit this month"
          />
        ) : null}
        <StatTile
          label="Awarded this month"
          value={formatRm(totals.month.value)}
          note={`${totals.month.count} ${totals.month.count === 1 ? "order" : "orders"}`}
        />
        <StatTile label="Sales this year" value={formatRm(totals.year.value)}>
          {me.yearlyTarget ? (
            <PaceBar
              done={totals.year.value}
              target={me.yearlyTarget}
              pace={yearPace(today)}
              label="Sales this year against yearly target"
              format={formatRm}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No yearly target set yet.
            </p>
          )}
        </StatTile>
        <StatTile
          label="Open pipeline"
          value={formatRm(sumRm(mine.map((project) => project.value)))}
          note={`${mine.length} ${mine.length === 1 ? "project" : "projects"} being chased`}
        />
        <StatTile
          label="Payment outstanding"
          value={formatRm(owed)}
          note="On orders registered under your name"
        />
        {own?.stats.kind === "bd" ? (
          <StatTile
            label="BD pass-down sales this month"
            value={formatRm(own.stats.passDownValue)}
            note={`${own.stats.passDownCount} ${own.stats.passDownCount === 1 ? "order" : "orders"}`}
          />
        ) : null}
      </TileGrid>
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
                    {project.companyName} · {ProjectStageLabel[project.stage]} ·{" "}
                    <span className="font-mono tabular-nums">
                      {formatRm(project.value)}
                    </span>
                  </p>
                </div>
                {project.overdue ? (
                  <StatusBadge tone="bad">
                    Next action {formatDate(project.nextActionDate ?? today)}
                  </StatusBadge>
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
