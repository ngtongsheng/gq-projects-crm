import { addDays } from "../../src/lib/format/date.ts";
import { projectId } from "./customers.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

/** Tasks in every status, with co-assignees and a few log lines. */
export function buildTasks({ people, today }: BuildContext): ExampleTable[] {
  const id = (key: string) => exampleId("tasks", key);
  const task = (
    key: string,
    row: Row & {
      status: string;
      assigned: number;
      due: number;
      submitted?: number;
      done?: number;
    },
  ): Row => {
    const { assigned, due, submitted, done, ...rest } = row;
    return {
      id: id(key),
      description: "",
      project_id: null,
      project_name: "",
      priority: "normal",
      revision_count: 0,
      assigned_on: addDays(today, assigned),
      due_on: addDays(today, due),
      submitted_at:
        submitted === undefined ? null : at(today, submitted, "16:00"),
      completed_at: done === undefined ? null : at(today, done, "11:00"),
      approved_by: done === undefined ? null : rest.assigned_by,
      ...rest,
    };
  };

  const tasks: Row[] = [
    task("showroom-catalogue", {
      title: "Prepare the Meridian showroom e-catalogue",
      category: "e_catalogue",
      project_id: projectId("meridian-showroom"),
      assignee_id: people.affifa,
      assigned_by: people.vernice,
      status: "not_started",
      assigned: -1,
      due: 6,
    }),
    task("kiara-design", {
      title: "Lobby carpet layout for Kiara hotel",
      description: "Two colourways, 1:50 plan, ready for Hana's review.",
      category: "design",
      project_id: projectId("kiara-hotel"),
      assignee_id: people.liza,
      assigned_by: people.eddie,
      priority: "high",
      status: "in_progress",
      assigned: -6,
      due: 2,
    }),
    task("orion-samples", {
      title: "Sample folders for the Orion tender",
      category: "sample_folder",
      project_id: projectId("orion-tower"),
      assignee_id: people.jess,
      assigned_by: people.vanessa,
      priority: "urgent",
      status: "in_progress",
      assigned: -9,
      due: -2,
    }),
    task("launch-poster", {
      title: "New wallpaper range launch poster",
      category: "product_launch",
      assignee_id: people.affifa,
      assigned_by: people.vanessa,
      status: "pending_review",
      assigned: -8,
      due: 1,
      submitted: -1,
    }),
    task("training-deck", {
      title: "Carpet tile installation training slides",
      category: "training_material",
      assignee_id: people.liza,
      assigned_by: people.vicky,
      priority: "low",
      status: "revision_required",
      revision_count: 1,
      assigned: -12,
      due: 3,
      submitted: -5,
    }),
    task("website-upload", {
      title: "Upload October projects to the website",
      category: "website_upload",
      assignee_id: people.affifa,
      assigned_by: people.vanessa,
      status: "completed",
      assigned: -14,
      due: -7,
      submitted: -8,
      done: -7,
    }),
  ];

  const coAssignees: Row[] = [
    { task_id: id("kiara-design"), profile_id: people.affifa },
    { task_id: id("orion-samples"), profile_id: people.waimun },
  ];

  const logLine = (
    key: string,
    taskKey: string,
    by: string,
    days: number,
    body: string,
  ): Row => ({
    id: exampleId("task_log_entries", key),
    task_id: id(taskKey),
    by_id: by,
    at: at(today, days, "14:00"),
    body,
  });
  const log: Row[] = [
    logLine("l1", "kiara-design", people.liza, -4, "First layout drafted."),
    logLine(
      "l2",
      "kiara-design",
      people.eddie,
      -3,
      "Please add a darker option.",
    ),
    logLine(
      "l3",
      "training-deck",
      people.vicky,
      -4,
      "Slides 4 and 5 need photos.",
    ),
    logLine(
      "l4",
      "website-upload",
      people.vanessa,
      -7,
      "Checked live. Thanks.",
    ),
  ];

  return [
    { table: "tasks", key: "id", rows: tasks },
    {
      table: "task_co_assignees",
      key: "task_id",
      rows: coAssignees,
      clearedByParent: true,
    },
    {
      table: "task_log_entries",
      key: "id",
      rows: log,
      clearedByParent: true,
    },
  ];
}
