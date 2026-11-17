import {
  buildActivities,
  buildCustomers,
  buildOwnershipRequests,
  buildProjects,
} from "./customers.ts";
import { buildHr } from "./hr.ts";
import { buildInstallers } from "./installation.ts";
import { buildLeave } from "./leave.ts";
import { buildLeftoverAllocations, buildLeftovers } from "./leftovers.ts";
import {
  buildInstallerClaims,
  buildMofs,
  buildMoney,
  buildSupplierPos,
} from "./orders.ts";
import { buildQuotes } from "./quotes.ts";
import { buildMonthlyReports } from "./reports.ts";
import { buildSamples } from "./samples.ts";
import {
  buildJobs,
  buildOtClaims,
  buildSiteBookings,
  buildSiteWork,
  buildStock,
} from "./site.ts";
import {
  buildFollowUpWaits,
  buildShootRequests,
  buildSiteOff,
} from "./site-team.ts";
import { buildTasks } from "./tasks.ts";
import type { BuildContext, ExampleTable } from "./types.ts";

export type ExampleData = {
  /** In the order they can be inserted: every table comes after the tables it points at. */
  tables: ExampleTable[];
  deliveriesToFinish: string[];
};

/** The whole example dataset. The same context always gives the same rows. */
export function buildExampleData(context: BuildContext): ExampleData {
  const jobs = buildJobs(context);
  return {
    tables: [
      ...buildCustomers(context),
      buildOwnershipRequests(context),
      buildActivities(context),
      buildProjects(context),
      ...buildMofs(context),
      buildSupplierPos(context),
      buildInstallers(),
      ...buildInstallerClaims(context),
      ...jobs.tables,
      buildSiteBookings(context),
      ...buildSiteWork(context),
      buildFollowUpWaits(context),
      buildSiteOff(context),
      buildShootRequests(context),
      buildOtClaims(context),
      buildLeftovers(context),
      buildLeftoverAllocations(context),
      ...buildSamples(context),
      ...buildStock(context),
      ...buildMoney(context),
      buildMonthlyReports(context),
      ...buildQuotes(context),
      ...buildTasks(context),
      ...buildLeave(context),
      ...buildHr(context),
    ],
    deliveriesToFinish: jobs.deliveriesToFinish,
  };
}
