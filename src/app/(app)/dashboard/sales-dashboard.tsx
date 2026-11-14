import type { Profile } from "@/lib/auth/current-profile";
import { attentionItems } from "@/lib/domain/attention";
import { salesTotals, yearPace } from "@/lib/domain/order-rollup";
import { pace as monthPace, weekKindFor } from "@/lib/domain/workdays";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { ProjectStageLabel } from "../projects/schemas";
import { loadInactiveCustomerOwners } from "./customer-data";
import { loadDashboardOrders } from "./dashboard-orders";
import { AttentionPanel, PaceBar, StatTile, TileGrid } from "./dashboard-parts";
import { loadOpenProjects, projectsOf } from "./pipeline-data";
import { ProjectsToChase } from "./projects-to-chase";
import { QuietCustomers } from "./quiet-customers";
import { loadOwnMonth } from "./report-snapshot";
import { TodaysActivities } from "./todays-activities";

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
  const calendar = await loadWorkCalendar(weekKindFor(me.jobRole));
  const paceNow = monthPace(today, calendar);

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
              pace={yearPace(today, calendar)}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <TodaysActivities title="Today" today={today} personId={me.id} />
        <QuietCustomers personId={me.id} today={today} />
      </div>
      <ProjectsToChase
        projects={mine}
        detail={(project) => (
          <>
            {project.companyName} · {ProjectStageLabel[project.stage]} ·{" "}
            <span className="font-mono tabular-nums">
              {formatRm(project.value)}
            </span>
          </>
        )}
        overdueLabel={(project) =>
          `Next action ${formatDate(project.nextActionDate ?? today)}`
        }
      />
    </div>
  );
}
