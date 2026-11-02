import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { type EditableProject, ProjectDialog } from "./project-form";
import { type ProjectStage, ProjectStageLabel } from "./schemas";

export type CustomerProject = EditableProject & {
  picName: string;
  supportName: string | null;
  canEdit: boolean;
};

export const stageTone: Record<ProjectStage, StatusTone> = {
  lead: "neutral",
  quotation_sent: "info",
  sample_mockup: "info",
  follow_up: "info",
  negotiation: "warn",
  awarded: "good",
  lost: "bad",
  on_hold: "neutral",
};

type CustomerProjectsProps = {
  contactId: string;
  customerName: string;
  projects: CustomerProject[];
  dialog: Omit<
    React.ComponentProps<typeof ProjectDialog>,
    "contactId" | "customerName" | "project"
  >;
};

/** Newest first, as the caller sorts them. */
export function CustomerProjects({
  contactId,
  customerName,
  projects,
  dialog,
}: CustomerProjectsProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Projects for this customer will show here."
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y">
      {projects.map((project) => (
        <li
          key={project.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{project.name}</span>
              <StatusBadge tone={stageTone[project.stage]}>
                {ProjectStageLabel[project.stage]}
              </StatusBadge>
            </div>
            <p className="font-mono text-sm tabular-nums">
              {formatRm(project.value)} ·{" "}
              {project.qtySqft.toLocaleString("en-MY")} sq ft
            </p>
            <p className="text-xs text-muted-foreground">
              {[project.picName, project.supportName]
                .filter(Boolean)
                .join(" + ")}
            </p>
            {project.nextAction && (
              <p className="text-sm text-muted-foreground">
                Next: {project.nextAction}
                {project.nextActionDate &&
                  ` · ${formatDate(project.nextActionDate)}`}
              </p>
            )}
          </div>
          {project.canEdit && (
            <ProjectDialog
              {...dialog}
              contactId={contactId}
              customerName={customerName}
              project={project}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
