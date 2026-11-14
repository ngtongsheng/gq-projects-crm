import { z } from "zod";
import type { Viewer } from "@/lib/auth/pages";
import { createClient } from "@/lib/supabase/server";
import { projectValueOf } from "./project-value";
import { loadQuotes } from "./quote-data";
import type { QuoteStatus } from "./quote-view";

/** One costing on a project card, as the card shows it. Cost and margin never appear here. */
export type ProjectCostingLine = {
  quoteId: string;
  quoteNo: string;
  status: QuoteStatus;
  salespersonName: string;
  options: { key: string; sell: number }[];
  /** The amount "Use RM X as project value" would write; null when it is not on offer. */
  useAsValue: number | null;
};

const mofRows = z.array(z.object({ project_id: z.string().nullable() }));

/**
 * The costings linked to each project, newest version of each. Only a viewer who may edit the
 * project and whose project has no MOF is offered a value to use. Costings are read through the
 * quote loader, so the database and the margin flag decide what this person sees.
 */
export async function loadProjectCosting(
  viewer: Viewer,
  projects: { id: string; canEdit: boolean }[],
): Promise<Map<string, ProjectCostingLine[]>> {
  const quotes = await loadQuotes(viewer);
  const editable = new Map(projects.map((p) => [p.id, p.canEdit]));
  const linked = quotes.filter(
    (quote) => quote.projectId !== null && editable.has(quote.projectId),
  );

  const withMof = new Set<string>();
  if (linked.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mofs")
      .select("project_id")
      .in("project_id", [...editable.keys()]);
    if (error) throw new Error(`Could not load MOFs: ${error.message}`);
    for (const row of mofRows.parse(data)) {
      if (row.project_id) withMof.add(row.project_id);
    }
  }

  const byProject = new Map<string, ProjectCostingLine[]>();
  for (const quote of linked.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )) {
    const latest = quote.revisions.at(-1);
    const projectId = quote.projectId;
    if (!latest || projectId === null) continue;
    const offered = editable.get(projectId) === true && !withMof.has(projectId);
    const line: ProjectCostingLine = {
      quoteId: quote.id,
      quoteNo: quote.quoteNo,
      status: latest.status,
      salespersonName: quote.salespersonName,
      options: latest.options.map(({ key, sell }) => ({ key, sell })),
      useAsValue: offered ? projectValueOf(latest) : null,
    };
    byProject.set(projectId, [...(byProject.get(projectId) ?? []), line]);
  }
  return byProject;
}
