import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { loadReportSettings, type ReportSettings } from "./report-data";

const monthParam = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((month) => `${month}-01`)
  .optional()
  .catch(undefined);
const personParam = z.uuid().optional().catch(undefined);

type SearchParams = Record<string, string | string[] | undefined>;

/** What every reports page needs to draw a month: who is looking, which month, the settings. */
export type ReportsView = {
  me: Profile;
  /** Where this page lives, for links back to it. */
  basePath: string;
  month: CalendarDate;
  today: CalendarDate;
  settings: ReportSettings;
  nameOf: Map<string, string>;
};

/** Reads ?month= and ?person= (ignoring anything invalid or in the future) and loads the settings. */
export async function loadReportsView(
  me: Profile,
  basePath: string,
  params: SearchParams,
): Promise<{ view: ReportsView; person: string | undefined }> {
  const today = todayMyt();
  const current = `${today.slice(0, 7)}-01`;
  const asked = monthParam.parse(params.month);
  const [settings, team] = await Promise.all([
    loadReportSettings(),
    getTeamDirectory(),
  ]);
  return {
    person: personParam.parse(params.person),
    view: {
      me,
      basePath,
      month: asked && asked <= current ? asked : current,
      today,
      settings,
      nameOf: new Map(team.map((member) => [member.id, member.name])),
    },
  };
}
