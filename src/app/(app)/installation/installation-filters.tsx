import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Translate } from "@/lib/i18n/translate";
import type { CalendarView } from "../calendar/calendar-params";
import { INSTALLATION_PATH } from "./installation-params";

const ALL = "all";

type Choice = { id: string; name: string };

type InstallationFiltersProps = {
  t: Translate;
  view: CalendarView;
  date: string;
  installers: Choice[];
  /** Absent for a Site Supervisor, who only sees their own jobs. */
  supervisors?: Choice[];
  installerId?: string;
  supervisorId?: string;
};

/** Filter the calendar by installer and by site supervisor (demo: instFT, instFS). */
export function InstallationFilters({
  t,
  view,
  date,
  installers,
  supervisors,
  installerId,
  supervisorId,
}: InstallationFiltersProps) {
  return (
    <form
      action={INSTALLATION_PATH}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="date" value={date} />
      <Select name="installer" defaultValue={installerId ?? ALL}>
        <SelectTrigger aria-label={t("Filter by installer")} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("All installers")}</SelectItem>
          {installers.map((installer) => (
            <SelectItem key={installer.id} value={installer.id}>
              {installer.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {supervisors && (
        <Select name="who" defaultValue={supervisorId ?? ALL}>
          <SelectTrigger
            aria-label={t("Filter by site supervisor")}
            className="w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("All site supervisors")}</SelectItem>
            {supervisors.map((supervisor) => (
              <SelectItem key={supervisor.id} value={supervisor.id}>
                {supervisor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button type="submit" variant="outline">
        {t("Show")}
      </Button>
    </form>
  );
}
