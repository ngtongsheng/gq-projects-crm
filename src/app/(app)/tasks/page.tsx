import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  canAddReferenceFile,
  canAssignTasks,
  canMoveDueDate,
  canMoveTask,
} from "@/lib/domain/task-flow";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { NewTaskDialog } from "./new-task-dialog";
import { TaskBannerLine } from "./task-banner-line";
import { loadTaskPeople, loadTaskProjects, loadTasks } from "./task-data";
import { loadTaskDetail } from "./task-detail-data";
import { TaskFilters } from "./task-filters";
import { TaskSheet } from "./task-sheet";
import { TaskTiles } from "./task-tiles";
import {
  countGiven,
  countMine,
  parseTaskParams,
  peopleOnTasks,
  selectTasks,
  taskBanner,
  taskListHref,
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
  const t = await getT(me.language);
  const viewer = { id: me.id, jobRole: me.jobRole };
  const [tasks, team] = await Promise.all([loadTasks(), getTeamDirectory()]);
  const query = await searchParams;
  const params = parseTaskParams(query, tasks, viewer);
  const assigns = canAssignTasks(me.jobRole);

  const [people, projects, calendar] = await Promise.all([
    assigns || params.view === "load" ? loadTaskPeople() : [],
    assigns ? loadTaskProjects() : [],
    assigns ? loadWorkCalendar("mon-fri") : null,
  ]);

  const today = todayMyt();
  const names = new Map(team.map((member) => [member.id, member.name]));
  const nameOf = (personId: string) => names.get(personId) ?? t("Unnamed");
  const banner = taskBanner(tasks, viewer, today, nameOf, t);
  const rows = selectTasks(tasks, params, viewer);

  const asked = Array.isArray(query.task) ? query.task[0] : query.task;
  const openId = z.uuid().safeParse(asked);
  const detail = openId.success ? await loadTaskDetail(openId.data) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Tasks")}
        description={t(
          "Assign work, follow deadlines and approve finished work. A task is completed only after the person who assigned it approves.",
        )}
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
      {banner && <TaskBannerLine banner={banner} t={t} />}
      <TasksTabs
        t={t}
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
            <h2 className="font-heading text-lg font-semibold">
              {t("Workload")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("Open tasks per person")}
            </p>
          </div>
          <WorkloadTable t={t} rows={workloadRows(tasks, people, today)} />
        </section>
      ) : (
        <>
          {params.view === "mine" && (
            <TaskTiles t={t} tiles={taskTiles(tasks, me.id, today)} />
          )}
          <TaskFilters
            t={t}
            params={params}
            people={peopleOnTasks(tasks)
              .map((id) => ({ id, name: nameOf(id) }))
              .sort((a, b) => a.name.localeCompare(b.name))}
            count={rows.length}
          />
          <TasksTable
            t={t}
            rows={rows}
            nameOf={nameOf}
            today={today}
            showAssignee={params.view !== "mine"}
            showAssigner={params.view !== "given"}
            hrefFor={(taskId) => taskListHref(params, taskId)}
          />
        </>
      )}
      {detail && (
        <TaskSheet
          task={detail}
          names={Object.fromEntries(
            [
              detail.assigneeId,
              detail.assignedBy,
              ...detail.coAssigneeIds,
              ...detail.files.map((file) => file.uploadedBy),
              ...detail.log.map((entry) => entry.byId),
            ].map((id) => [id, nameOf(id)]),
          )}
          today={today}
          can={{
            start: canMoveTask(detail, viewer, "start"),
            submit: canMoveTask(detail, viewer, "submit"),
            review: canMoveTask(detail, viewer, "approve"),
            moveDate: canMoveDueDate(detail, viewer),
            addReference: canAddReferenceFile(detail, viewer),
          }}
          closeHref={taskListHref(params)}
        />
      )}
    </div>
  );
}
