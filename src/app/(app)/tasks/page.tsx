import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { canAssignTasks } from "@/lib/domain/task-flow";
import { todayMyt } from "@/lib/format/date";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { NewTaskDialog } from "./new-task-dialog";
import { TaskBannerLine } from "./task-banner-line";
import { loadTaskPeople, loadTaskProjects, loadTasks } from "./task-data";
import { TaskFilters } from "./task-filters";
import { TaskTiles } from "./task-tiles";
import {
  countGiven,
  countMine,
  parseTaskParams,
  peopleOnTasks,
  selectTasks,
  taskBanner,
  taskTiles,
  viewsFor,
  workloadRows,
} from "./task-view";
import { TasksTable } from "./tasks-table";
import { TasksTabs } from "./tasks-tabs";
import { WorkloadTable } from "./workload-table";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("tasks");
  const viewer = { id: me.id, jobRole: me.jobRole };
  const [tasks, team] = await Promise.all([loadTasks(), getTeamDirectory()]);
  const params = parseTaskParams(await searchParams, tasks, viewer);
  const assigns = canAssignTasks(me.jobRole);

  const [people, projects, calendar] = await Promise.all([
    assigns || params.view === "load" ? loadTaskPeople() : [],
    assigns ? loadTaskProjects() : [],
    assigns ? loadWorkCalendar("mon-fri") : null,
  ]);

  const today = todayMyt();
  const names = new Map(team.map((member) => [member.id, member.name]));
  const nameOf = (personId: string) => names.get(personId) ?? "Unnamed";
  const banner = taskBanner(tasks, viewer, today, nameOf);
  const rows = selectTasks(tasks, params, viewer);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tasks"
        description="Assign work, follow deadlines and approve finished work. A task is completed only after the person who assigned it approves."
        actions={
          assigns && calendar ? (
            <NewTaskDialog
              people={people.filter((person) => person.id !== me.id)}
              projects={projects}
              holidays={[...calendar.holidays]}
              today={today}
            />
          ) : null
        }
      />
      {banner && <TaskBannerLine banner={banner} />}
      <TasksTabs
        views={viewsFor(viewer)}
        active={params.view}
        counts={{
          mine: countMine(tasks, viewer),
          given: countGiven(tasks, viewer),
        }}
      />
      {params.view === "load" ? (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="font-heading text-lg font-semibold">Workload</h2>
            <p className="text-sm text-muted-foreground">
              Open tasks per person
            </p>
          </div>
          <WorkloadTable rows={workloadRows(tasks, people, today)} />
        </section>
      ) : (
        <>
          {params.view === "mine" && (
            <TaskTiles tiles={taskTiles(tasks, me.id, today)} />
          )}
          <TaskFilters
            params={params}
            people={peopleOnTasks(tasks)
              .map((id) => ({ id, name: nameOf(id) }))
              .sort((a, b) => a.name.localeCompare(b.name))}
            count={rows.length}
          />
          <TasksTable
            rows={rows}
            nameOf={nameOf}
            today={today}
            showAssignee={params.view !== "mine"}
            showAssigner={params.view !== "given"}
          />
        </>
      )}
    </div>
  );
}
