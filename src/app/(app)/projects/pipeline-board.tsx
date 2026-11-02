import { FolderKanban } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import type { ProjectFlags } from "@/lib/domain/project-flags";
import { formatDate } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { stageTone } from "./customer-projects";
import { type ProjectStage, ProjectStageLabel } from "./schemas";
import { StageSelect } from "./stage-select";

export type PipelineProject = {
  id: string;
  name: string;
  contactId: string;
  customerName: string;
  companyName: string;
  stage: ProjectStage;
  qtySqft: number;
  value: number;
  picId: string;
  supportId: string | null;
  picName: string;
  supportName: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  estCommission: number;
  flags: ProjectFlags;
  canEdit: boolean;
};

function FlagBadges({ flags }: { flags: ProjectFlags }) {
  return (
    <>
      {flags.overdue && <StatusBadge tone="bad">Overdue</StatusBadge>}
      {flags.stale && <StatusBadge tone="warn">Stale</StatusBadge>}
    </>
  );
}

const people = (project: PipelineProject) =>
  [project.picName, project.supportName].filter(Boolean).join(" + ");

function StageControl({ project }: { project: PipelineProject }) {
  return project.canEdit ? (
    <StageSelect projectId={project.id} stage={project.stage} />
  ) : (
    <StatusBadge tone={stageTone[project.stage]}>
      {ProjectStageLabel[project.stage]}
    </StatusBadge>
  );
}

function ProjectCard({ project }: { project: PipelineProject }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{project.name}</span>
        <Link
          href={`/customers/${project.contactId}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          {project.customerName} · {project.companyName}
        </Link>
      </div>
      <p className="font-mono text-sm tabular-nums">
        {formatRm(project.value)} · {project.qtySqft.toLocaleString("en-MY")} sq
        ft
        <span className="text-xs text-muted-foreground">
          {" "}
          · est. commission {formatRm(project.estCommission)}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{people(project)}</p>
      {project.nextAction && (
        <p className="text-xs text-muted-foreground">
          Next: {project.nextAction}
          {project.nextActionDate && ` · ${formatDate(project.nextActionDate)}`}
        </p>
      )}
      {(project.flags.overdue || project.flags.stale) && (
        <div className="flex flex-wrap gap-1.5">
          <FlagBadges flags={project.flags} />
        </div>
      )}
      <StageControl project={project} />
    </li>
  );
}

/** One column per stage, in pipeline order. Scrolls sideways on a phone. */
export function PipelineBoard({
  projects,
  stages,
  empty,
}: {
  projects: PipelineProject[];
  stages: readonly ProjectStage[];
  empty: ReactNode;
}) {
  if (projects.length === 0) {
    return <div className="rounded-xl border bg-card">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {stages.map((stage) => {
          const inStage = projects.filter((project) => project.stage === stage);
          return (
            <section
              key={stage}
              aria-label={ProjectStageLabel[stage]}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-sunk p-2"
            >
              <header className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-sm font-semibold">
                  {ProjectStageLabel[stage]}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {inStage.length}
                  </span>
                </h2>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatRm(sumRm(inStage.map((project) => project.value)))}
                </span>
              </header>
              <ul className="flex flex-col gap-2">
                {inStage.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineList({
  projects,
  empty,
}: {
  projects: PipelineProject[];
  empty: ReactNode;
}) {
  return (
    <DataTable
      rows={projects}
      getRowKey={(row) => row.id}
      empty={empty}
      columns={[
        {
          key: "name",
          header: "Project",
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-medium">{row.name}</span>
              <Link
                href={`/customers/${row.contactId}`}
                className="text-xs text-muted-foreground hover:underline"
              >
                {row.customerName} · {row.companyName}
              </Link>
            </div>
          ),
        },
        {
          key: "stage",
          header: "Stage",
          cell: (row) => <StageControl project={row} />,
        },
        {
          key: "flags",
          header: "Flags",
          cell: (row) => (
            <div className="flex flex-wrap gap-1.5">
              <FlagBadges flags={row.flags} />
            </div>
          ),
        },
        {
          key: "value",
          header: "Value",
          numeric: true,
          cell: (row) => formatRm(row.value),
        },
        {
          key: "commission",
          header: "Est. commission",
          numeric: true,
          cell: (row) => formatRm(row.estCommission),
        },
        { key: "people", header: "PIC", cell: (row) => people(row) },
        {
          key: "next",
          header: "Next action",
          cell: (row) =>
            row.nextAction ? (
              <div className="flex flex-col">
                <span>{row.nextAction}</span>
                {row.nextActionDate && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(row.nextActionDate)}
                  </span>
                )}
              </div>
            ) : (
              "–"
            ),
        },
      ]}
    />
  );
}

export const pipelineEmpty = (filtered: boolean) => (
  <EmptyState
    icon={FolderKanban}
    title={filtered ? "No projects match" : "No projects yet"}
    description={
      filtered
        ? "Try a different person or show everyone."
        : "Add a project from a customer's page to start the pipeline."
    }
  />
);
