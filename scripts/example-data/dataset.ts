import {
  buildActivities,
  buildCustomers,
  buildOwnershipRequests,
  buildProjects,
} from "./customers.ts";
import {
  buildInstallerClaims,
  buildMofs,
  buildMoney,
  buildSupplierPos,
} from "./orders.ts";
import { buildQuotes } from "./quotes.ts";
import { buildMonthlyReports } from "./reports.ts";
import {
  buildJobs,
  buildLeftovers,
  buildOtClaims,
  buildSiteBookings,
  buildSiteWork,
  buildStock,
} from "./site.ts";
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
      ...buildInstallerClaims(context),
      ...jobs.tables,
      buildSiteBookings(context),
      ...buildSiteWork(context),
      buildOtClaims(context),
      buildLeftovers(),
      ...buildStock(context),
      ...buildMoney(context),
      buildMonthlyReports(context),
      ...buildQuotes(context),
    ],
    deliveriesToFinish: jobs.deliveriesToFinish,
  };
}
