import { ClipboardX } from "lucide-react";
import type { ReactNode } from "react";
import type { Profile } from "@/lib/auth/current-profile";
import { canChangeSettings, isManager } from "@/lib/auth/job-role";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import { gridDays } from "@/lib/domain/site-daily-log";
import { missedLogDays, SITE_OFF_KIND_LABEL } from "@/lib/domain/site-log";
import {
  DEFAULT_SUPERVISOR_REMINDER,
  dailyLogReminderText,
} from "@/lib/domain/site-reminders";
import { clockTimeMyt } from "@/lib/format/clock-time-myt";
import { formatDate, todayMyt } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { loadSiteSupervisors } from "../installation/booking-data";
import { loadLeavePeople, loadLeaveRows } from "../leave/leave-data";
import {
  DAILY_LOG_DAYS,
  loadSupervisorWeek,
  type SupervisorWeek,
} from "./daily-log-data";
import { DailyLogGrid } from "./daily-log-grid";
import { PlanVsDonePanel } from "./plan-vs-done-panel";
import { ReminderSettingsForm } from "./reminder-settings-form";
import { loadSiteReminders } from "./site-reminder-data";

// People the missing list can go to: the owners and the support team.
const LIST_RECIPIENT_ROLES = ["md", "director", "support"];

const shortLeave = (label: string) => label.split(" (")[0];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Daily log and reminders for managers and the support team: who logged each of the last seven
 * days, the plan against the log, and the reminder settings (demo: siteRemind). The reminders
 * are only worked out and stored here; nothing is sent until Integration (loop 17 D4).
 */
export async function DailyLogTab({
  me,
  nameOf,
  t,
}: {
  me: Profile;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const today = todayMyt();
  const manager = isManager(me.jobRole);
  const [supervisors, calendar, settings, leave, people] = await Promise.all([
    loadSiteSupervisors(),
    loadWorkCalendar("mon-sat"),
    loadSiteReminders(),
    loadLeaveRows(),
    manager ? loadLeavePeople(nameOf) : [],
  ]);
  const joined = new Map(people.map((person) => [person.id, person.joinedOn]));
  const weeks: SupervisorWeek[] = await Promise.all(
    supervisors.map((supervisor) =>
      loadSupervisorWeek({
        supervisor: {
          ...supervisor,
          joinedOn: joined.get(supervisor.id) ?? null,
        },
        today,
        leave,
        leaveLabel: (row) => t(shortLeave(LEAVE_TYPE_LABEL[row.leaveType])),
        siteOffLabel: (kind) => t(SITE_OFF_KIND_LABEL[kind]),
      }),
    ),
  );

  const missing = weeks
    .map((week) => ({
      week,
      days: missedLogDays({
        today,
        holidays: calendar.holidays,
        away: week.away,
        joinedOn: week.joinedOn,
        loggedDays: week.logs.map((log) => log.visitedOn),
      }),
    }))
    .filter((entry) => entry.days.length > 0);

  const listCandidates = people
    .filter((person) => LIST_RECIPIENT_ROLES.includes(person.jobRole))
    .map((person) => ({ id: person.id, name: person.name }));
  const recipients = [
    ...listCandidates,
    ...settings.missingListTo
      .filter((id) => !listCandidates.some((person) => person.id === id))
      .map((id) => ({ id, name: nameOf(id) })),
  ];
  const reminderOf = (id: string) =>
    settings.supervisors[id] ?? DEFAULT_SUPERVISOR_REMINDER;
  const sample = weeks[0];
  const reminderTimePassed = clockTimeMyt() >= settings.dailyTime;

  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border bg-bad-bg p-4 text-sm text-bad">
          <p className="flex items-center gap-2 font-medium">
            <ClipboardX className="size-4" aria-hidden />
            {t("Daily site log missing")}:
          </p>
          <ul>
            {missing.map(({ week, days }) => (
              <li key={week.id}>
                {week.name} – {days.map(formatDate).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Section
        title={`${t("Daily log")} · ${t("last 7 days")}`}
        note={t("Mon-Sat. Leave, MC and office days must be recorded too.")}
      >
        <DailyLogGrid
          weeks={weeks}
          days={gridDays(today, DAILY_LOG_DAYS)}
          today={today}
          calendar={calendar}
          reminderTimePassed={reminderTimePassed}
          t={t}
        />
      </Section>
      {weeks.map((week) => (
        <PlanVsDonePanel
          key={week.id}
          week={week}
          today={today}
          holidays={calendar.holidays}
          t={t}
        />
      ))}
      <Section
        title={t("Reminder by WhatsApp or email")}
        note={t(
          "Saved here for Integration. Nothing is sent from this page yet.",
        )}
      >
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <ReminderSettingsForm
            settings={settings}
            supervisors={weeks.map((week) => ({
              id: week.id,
              name: week.name,
              reminder: reminderOf(week.id),
            }))}
            recipients={recipients}
            canEdit={canChangeSettings(me)}
          />
          {sample && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-3 text-sm">
              <span className="text-xs text-muted-foreground">
                {`${t("Message the supervisor gets")} (${sample.name}):`}
              </span>
              <p className="whitespace-pre-wrap">
                {dailyLogReminderText(
                  sample.name,
                  reminderOf(sample.id).language,
                  today,
                )}
              </p>
              <span className="text-xs text-muted-foreground">
                {`${t("Next morning")} ${settings.nextMorningTime} ${t("to")} ${
                  settings.missingListTo.map(nameOf).join(", ") || t("nobody")
                }: "${t("Site log missing yesterday")}: …"`}
              </span>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
