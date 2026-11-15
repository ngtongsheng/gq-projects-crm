import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUSES } from "@/lib/domain/task-flow";
import { TASK_STATUS_LABEL } from "@/lib/domain/task-labels";
import type { Translate } from "@/lib/i18n/translate";
import type { TaskParams } from "./task-view";

/** Status for every list; person on the tabs that show other people's tasks. A plain form, so it needs no script. */
export function TaskFilters({
  params,
  people,
  count,
  t,
}: {
  t: Translate;
  params: TaskParams;
  people: { id: string; name: string }[];
  count: number;
}) {
  return (
    <form action="/tasks" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="view" value={params.view} />
      <Select name="status" defaultValue={params.status}>
        <SelectTrigger aria-label={t("Status")} className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">{t("Open tasks")}</SelectItem>
          {TASK_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {t(TASK_STATUS_LABEL[status])}
            </SelectItem>
          ))}
          <SelectItem value="all">{t("All")}</SelectItem>
        </SelectContent>
      </Select>
      {params.view !== "mine" && (
        <Select name="person" defaultValue={params.person}>
          <SelectTrigger aria-label={t("Person")} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Everyone")}</SelectItem>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button type="submit" variant="outline">
        <Search data-icon="inline-start" />
        {t("Filter")}
      </Button>
      <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
        {count} {t(count === 1 ? "task" : "tasks")}
      </span>
    </form>
  );
}
