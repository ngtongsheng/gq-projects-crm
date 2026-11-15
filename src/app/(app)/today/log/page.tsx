import type { Metadata } from "next";
import { z } from "zod";
import { LanguageToggle } from "@/components/app/language-toggle";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { startOfMonth } from "@/lib/domain/calendar-grid";
import { addWorkdays } from "@/lib/domain/task-due-date";
import { weekKindFor } from "@/lib/domain/workdays";
import { formatDate, todayMyt } from "@/lib/format/date";
import { resolveLanguage } from "@/lib/i18n/current-language";
import { getT } from "@/lib/i18n/server-t";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { loadReportSettings } from "../../reports/report-data";
import { loadMyLogs } from "../today-data";
import { loadMofChoices, loadPipelineProjects } from "./log-work-data";
import { LogWorkWizard } from "./wizard";

export const metadata: Metadata = { title: "Log work" };

const dayParam = z.iso.date();

// Follow-up chips: tomorrow, in two working days, next week (demo: lwDue).
const DUE_CHOICES = [
  { label: "Tomorrow", workdays: 1 },
  { label: "In 2 days", workdays: 2 },
  { label: "Next week", workdays: 5 },
] as const;

const text = (value: string | string[] | undefined) =>
  typeof value === "string" && value !== "" ? value : null;

/** The Log work wizard, opened from the home page with the day, and the site and activity when known. */
export default async function LogWorkWizardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("today");
  const t = await getT(me.language);
  const today = todayMyt();
  const params = await searchParams;
  const asked = dayParam.safeParse(params.date);
  const day = asked.success && asked.data <= today ? asked.data : today;

  const [mofs, projects, team, logs, settings, calendar] = await Promise.all([
    loadMofChoices(me.id),
    loadPipelineProjects(),
    getTeamDirectory(),
    loadMyLogs(me.id, startOfMonth(day), day),
    loadReportSettings(),
    loadWorkCalendar(weekKindFor(me.jobRole)),
  ]);

  const uuid = z.uuid();
  const idParam = (value: string | string[] | undefined) => {
    const parsed = uuid.safeParse(text(value));
    return parsed.success ? parsed.data : null;
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        title={t("Log work")}
        description={`${me.fullName ?? ""} · ${formatDate(day)}`}
        actions={
          <LanguageToggle
            language={await resolveLanguage(me.language)}
            languages={["en", "bm"]}
          />
        }
      />
      <LogWorkWizard
        day={day}
        today={today}
        supervisorName={me.fullName ?? ""}
        mofs={mofs}
        projects={projects}
        people={team}
        dueOptions={DUE_CHOICES.map((choice) => ({
          label: choice.label,
          on: addWorkdays(today, choice.workdays, calendar),
        }))}
        monthLogs={logs.map((log) => ({
          visitedOn: log.visitedOn,
          mofId: log.mofId,
          siteName: log.siteName,
        }))}
        visitTarget={settings.targets.siteVisits}
        preset={{
          mofId: idParam(params.mof),
          projectId: idParam(params.project),
          siteName: text(params.site),
          activity: text(params.activity),
        }}
      />
    </div>
  );
}
