import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import { Panel, PanelEmpty } from "./dashboard-parts";
import { type OpenProject, projectsToChase } from "./pipeline-data";

const SHOWN = 8;

/** Open projects past their next action date or not touched lately, overdue ones first. */
export function ProjectsToChase({
  projects,
  detail,
  overdueLabel,
}: {
  projects: readonly OpenProject[];
  /** The grey line under the project name. */
  detail: (project: OpenProject) => ReactNode;
  overdueLabel: (project: OpenProject) => string;
}) {
  const chase = projectsToChase(projects);
  return (
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
          Every open project has a next action date ahead and was updated in the
          last 14 days.
        </PanelEmpty>
      ) : (
        <ul className="divide-y">
          {chase.slice(0, SHOWN).map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{project.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {detail(project)}
                </p>
              </div>
              {project.overdue ? (
                <StatusBadge tone="bad">{overdueLabel(project)}</StatusBadge>
              ) : null}
              {project.stale ? (
                <StatusBadge tone="warn">No update in 14+ days</StatusBadge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
