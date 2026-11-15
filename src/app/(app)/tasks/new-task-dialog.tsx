"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { addWorkdays } from "@/lib/domain/task-due-date";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  type TaskCategory,
  type TaskPriority,
} from "@/lib/domain/task-flow";
import { TASK_CATEGORY_LABEL } from "@/lib/domain/task-labels";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { createTask } from "./actions";
import type { TaskPerson } from "./task-view";

const NO_PROJECT = "none";
const DEFAULT_DAYS = 3;
const CUSTOMER_DAYS = 2;
// Demo: customer work is usually quicker, so a still-default estimate drops to two days.
const customerWork = (category: TaskCategory) =>
  category === "customer_appointment" || category === "follow_up_customer";

/** The demo's New task sheet; the assigner picks who does it, who helps, and the due date follows the working days. */
export function NewTaskDialog({
  people,
  projects,
  holidays,
  today,
}: {
  /** Everyone still here except the person assigning. */
  people: TaskPerson[];
  projects: { id: string; label: string }[];
  /** Public holidays, so the due date skips them. */
  holidays: string[];
  today: string;
}) {
  const calendar = { week: "mon-fri", holidays: new Set(holidays) } as const;
  const dueFor = (from: string, workingDays: number) =>
    addWorkdays(from, workingDays, calendar);

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [category, setCategory] = useState<TaskCategory>("design");
  const [coIds, setCoIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [assignedOn, setAssignedOn] = useState(today);
  const [dueOn, setDueOn] = useState(() => dueFor(today, DEFAULT_DAYS));

  // Designers and marketing first: they are who tasks usually go to (demo).
  const helpers = [...people].sort(
    (a, b) =>
      Number(b.jobRole === "designer" || b.jobRole === "marketing") -
      Number(a.jobRole === "designer" || a.jobRole === "marketing"),
  );

  function changeCategory(next: TaskCategory) {
    setCategory(next);
    if (customerWork(next) && days === DEFAULT_DAYS) {
      setDays(CUSTOMER_DAYS);
      setDueOn(dueFor(assignedOn || today, CUSTOMER_DAYS));
    }
  }

  function changeDays(next: number) {
    setDays(next);
    setDueOn(dueFor(assignedOn || today, next));
  }

  function changeAssignedOn(next: string) {
    setAssignedOn(next);
    if (next) setDueOn(dueFor(next, days));
  }

  function reset() {
    setAssigneeId("");
    setCategory("design");
    setCoIds([]);
    setProjectId(NO_PROJECT);
    setPriority("normal");
    setDays(DEFAULT_DAYS);
    setAssignedOn(today);
    setDueOn(dueFor(today, DEFAULT_DAYS));
  }

  function save(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await createTask(formData);
      setError(result.error);
      if (result.error) return;
      const names = [assigneeId, ...coIds]
        .map((id) => people.find((person) => person.id === id)?.name)
        .filter(Boolean)
        .join(" + ");
      toast.success(`Task assigned to ${names}.`);
      form.reset();
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Name the person who does it. The task is completed only after you
            approve it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="assigneeId" value={assigneeId} />
          <input type="hidden" name="category" value={category} />
          <input
            type="hidden"
            name="projectId"
            value={projectId === NO_PROJECT ? "" : projectId}
          />
          <input type="hidden" name="priority" value={priority} />
          {coIds.map((id) => (
            <input key={id} type="hidden" name="coAssigneeIds" value={id} />
          ))}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="taskTitle">Task title</FieldLabel>
              <Input
                id="taskTitle"
                name="title"
                maxLength={200}
                placeholder="e.g. E-catalogue for new SPC range"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="taskDescription">Description</FieldLabel>
              <Textarea
                id="taskDescription"
                name="description"
                rows={3}
                maxLength={4000}
                placeholder="What exactly is needed, sizes, where it will be used..."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="taskAssignee">Assign to</FieldLabel>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger id="taskAssignee">
                    <SelectValue placeholder="Choose who does it" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name} · {JobRoleLabel[person.jobRole]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>The main person.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="taskCategory">Type</FieldLabel>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    changeCategory(value as TaskCategory)
                  }
                >
                  <SelectTrigger id="taskCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {TASK_CATEGORY_LABEL[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">
                Working together with
              </legend>
              <p className="text-xs text-muted-foreground">
                Optional. e.g. Marketing writes the text, the designer designs.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border p-3">
                {helpers
                  .filter((person) => person.id !== assigneeId)
                  .map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`taskWith-${person.id}`}
                        checked={coIds.includes(person.id)}
                        onCheckedChange={(checked) =>
                          setCoIds((current) =>
                            checked === true
                              ? [...current, person.id]
                              : current.filter((id) => id !== person.id),
                          )
                        }
                      />
                      <Label
                        htmlFor={`taskWith-${person.id}`}
                        className="font-normal"
                      >
                        {person.name}
                      </Label>
                    </div>
                  ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="taskProject">Project</FieldLabel>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="taskProject">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Optional.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="taskProjectName">
                  Or customer / project name
                </FieldLabel>
                <Input
                  id="taskProjectName"
                  name="projectName"
                  maxLength={200}
                  placeholder="e.g. Unijoy launch"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="taskPriority">Priority</FieldLabel>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TaskPriority)}
                >
                  <SelectTrigger id="taskPriority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {TASK_PRIORITY_LABEL[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="taskDays">
                  Expected working days
                </FieldLabel>
                <Input
                  id="taskDays"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={days}
                  onChange={(event) =>
                    changeDays(Math.max(0, Number(event.target.value) || 0))
                  }
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="taskAssignedOn">Date assigned</FieldLabel>
                <Input
                  id="taskAssignedOn"
                  name="assignedOn"
                  type="date"
                  value={assignedOn}
                  onChange={(event) => changeAssignedOn(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="taskDueOn">Due date</FieldLabel>
                <Input
                  id="taskDueOn"
                  name="dueOn"
                  type="date"
                  value={dueOn}
                  onChange={(event) => setDueOn(event.target.value)}
                  required
                />
                <FieldDescription>
                  Worked out from the days; you can change it.
                </FieldDescription>
              </Field>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Assign task"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
