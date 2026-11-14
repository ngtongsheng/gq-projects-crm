import { Search } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canOpen } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { estimatedCommission } from "@/lib/domain/commission";
import { projectFlags } from "@/lib/domain/project-flags";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionSettings } from "../commission/commission-settings-data";
import {
  loadProjectCosting,
  type ProjectCostingLine,
} from "../costing/project-costing-data";
import { AccountType } from "../customers/schemas";
import {
  PipelineBoard,
  PipelineList,
  type PipelineProject,
  pipelineEmpty,
} from "./pipeline-board";
import { canEditProject } from "./project-access";
import { filterByPerson, parsePipelineFilters } from "./project-filters";
import { OPEN_STAGES, ProjectStage } from "./schemas";

export const metadata: Metadata = { title: "Projects" };

const ALL = "all";

const projectRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    name: z.string(),
    stage: ProjectStage,
    qty_sqft: z.number(),
    value: z.number(),
    pic_id: z.string(),
    support_id: z.string().nullable(),
    commission_type: AccountType,
    next_action: z.string().nullable(),
    next_action_date: z.string().nullable(),
    updated_at: z.string(),
    contacts: z.object({
      name: z.string(),
      companies: z.object({ name: z.string() }),
    }),
  }),
);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("proj");
  const filters = parsePipelineFilters(await searchParams);
  const supabase = await createClient();

  const [projectsResult, team, commissionSettings] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, contact_id, name, stage, qty_sqft, value, pic_id, support_id, commission_type, next_action, next_action_date, updated_at, contacts(name, companies(name))",
      )
      .order("created_at", { ascending: false }),
    getTeamDirectory(),
    loadCommissionSettings(),
  ]);
  if (projectsResult.error) {
    throw new Error(`Could not load projects: ${projectsResult.error.message}`);
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const today = todayMyt();
  const rows = projectRows.parse(projectsResult.data);
  const canEditRow = (row: (typeof rows)[number]) =>
    canEditProject(
      me.jobRole,
      row.pic_id === me.id || row.support_id === me.id,
    );
  // Costing lines are for people with the Costing page; the quote loader applies the margin flag.
  const costing: Map<string, ProjectCostingLine[]> = (await canOpen(me, "cost"))
    ? await loadProjectCosting(
        me,
        rows.map((row) => ({ id: row.id, canEdit: canEditRow(row) })),
      )
    : new Map();
  const all: PipelineProject[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    contactId: row.contact_id,
    customerName: row.contacts.name,
    companyName: row.contacts.companies.name,
    stage: row.stage,
    qtySqft: row.qty_sqft,
    value: row.value,
    picId: row.pic_id,
    supportId: row.support_id,
    picName: nameOf.get(row.pic_id) ?? "Unnamed",
    supportName: row.support_id
      ? (nameOf.get(row.support_id) ?? "Unnamed")
      : null,
    nextAction: row.next_action,
    nextActionDate: row.next_action_date,
    estCommission: estimatedCommission(
      row.value,
      row.commission_type,
      commissionSettings,
    ),
    flags: projectFlags(
      {
        open: OPEN_STAGES.includes(row.stage),
        nextActionDate: row.next_action_date,
        updatedAt: row.updated_at,
      },
      today,
    ),
    canEdit: canEditRow(row),
    costing: costing.get(row.id) ?? [],
  }));
  const projects = filterByPerson(all, filters.person);
  const empty = pipelineEmpty(filters.person !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Projects"
        description={
          me.jobRole === "bd" || me.jobRole === "sales"
            ? "Your deals by stage: the ones you lead, support or passed down. Add a project from the customer's page."
            : "Every deal by stage. Add a project from the customer's page."
        }
      />
      <form action="/projects" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value={filters.view} />
        <Select name="person" defaultValue={filters.person ?? ALL}>
          <SelectTrigger aria-label="Person" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everyone</SelectItem>
            {team.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Filter
        </Button>
        <div className="ml-auto flex gap-1">
          {(["board", "list"] as const).map((view) => (
            <Button
              key={view}
              asChild
              size="sm"
              variant={filters.view === view ? "secondary" : "ghost"}
            >
              <a
                href={`/projects?view=${view}${filters.person ? `&person=${filters.person}` : ""}`}
                aria-current={filters.view === view ? "page" : undefined}
              >
                {view === "board" ? "Board" : "List"}
              </a>
            </Button>
          ))}
        </div>
      </form>
      {filters.view === "board" ? (
        <PipelineBoard
          projects={projects}
          stages={ProjectStage.options}
          empty={empty}
        />
      ) : (
        <PipelineList projects={projects} empty={empty} />
      )}
    </div>
  );
}
