import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { MofStage } from "./schemas";

// Anything unrecognised falls back to all stages and everyone.
const filterParams = z.object({
  stage: MofStage.optional().catch(undefined),
  person: z.uuid().optional().catch(undefined),
});
export type MofFilters = z.infer<typeof filterParams>;

export function parseMofFilters(
  params: Record<string, string | string[] | undefined>,
): MofFilters {
  return filterParams.parse({ stage: params.stage, person: params.person });
}

/** Salespeople see "My Sales"; the MD, Purchasing and HR & Accounts see the whole register. */
export const seesOnlyOwnMofs = (jobRole: JobRole): boolean =>
  jobRole === "bd" || jobRole === "sales";

type Filterable = {
  stage: MofStage;
  salespersonId: string;
  secondSalespersonId: string | null;
};

/** A person is on an MOF as its salesperson or its second salesperson. */
export function filterMofs<Row extends Filterable>(
  rows: Row[],
  filters: MofFilters,
): Row[] {
  return rows.filter(
    (row) =>
      (!filters.stage || row.stage === filters.stage) &&
      (!filters.person ||
        row.salespersonId === filters.person ||
        row.secondSalespersonId === filters.person),
  );
}

/** Salespeople only ever get their own MOFs, whatever the address bar says. */
export function visibleMofs<Row extends Filterable>(
  rows: Row[],
  me: { id: string; jobRole: JobRole },
  filters: MofFilters,
): Row[] {
  const scoped = seesOnlyOwnMofs(me.jobRole)
    ? filterMofs(rows, { person: me.id })
    : rows;
  return filterMofs(scoped, filters);
}
