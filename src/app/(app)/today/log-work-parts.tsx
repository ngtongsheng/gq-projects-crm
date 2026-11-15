import { Package, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_ACTIVITY_LABEL } from "@/lib/domain/site-log";
import type { PlannedWork } from "@/lib/domain/site-plan";
import { addDays, type CalendarDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { PaceBar } from "../dashboard/dashboard-parts";
import { ACTIVITY_ICON } from "./activity-icon";
import { recordHref } from "./record-link";
import type { MyLog } from "./today-data";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Today / Yesterday / any earlier day (demo: lwDate). */
export function DayPicker({
  day,
  today,
  t,
}: {
  day: CalendarDate;
  today: CalendarDate;
  t: Translate;
}) {
  const yesterday = addDays(today, -1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex gap-1 rounded-lg border border-border bg-sunk p-1">
        {(
          [
            [today, "Today"],
            [yesterday, "Yesterday"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            asChild
            size="sm"
            variant={day === value ? "default" : "ghost"}
          >
            <Link
              href={value === today ? "/today" : `/today?date=${value}`}
              aria-current={day === value ? "page" : undefined}
            >
              {t(label)}
            </Link>
          </Button>
        ))}
      </div>
      <form action="/today" className="flex items-center gap-2">
        <label htmlFor="otherDay" className="text-sm text-muted-foreground">
          {t("Other day")}
        </label>
        <Input
          id="otherDay"
          name="date"
          type="date"
          defaultValue={day}
          max={today}
          className="w-auto"
        />
        <Button type="submit" size="sm" variant="outline">
          {t("Show")}
        </Button>
      </form>
    </div>
  );
}

/** The month's visits against the target, and the stock returns logged (demo: "This month"). */
export function MonthCounter({
  visits,
  target,
  pace,
  stockReturns,
  t,
}: {
  visits: number;
  target: number;
  /** Share of the month gone, so the bar shows where the supervisor should be. */
  pace: number;
  stockReturns: number;
  t: Translate;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("This month")}
      </h2>
      <p className="font-heading text-3xl font-semibold">
        <span className="font-mono tabular-nums">{visits}</span>{" "}
        <span className="text-base font-normal text-muted-foreground">
          / <span className="font-mono tabular-nums">{target}</span>{" "}
          {t("site visits")}
        </span>
      </p>
      <PaceBar
        done={visits}
        target={target}
        pace={pace}
        label={t("Site visits against target")}
      />
      <p className="flex items-center gap-2 text-sm">
        <Package className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-mono font-semibold tabular-nums">
          {stockReturns}
        </span>{" "}
        {t("Stock returns")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "Every site counts: inspection, measurement, delivery, installation, handover, shooting. Same site on the same day = 1 visit.",
        )}
      </p>
    </section>
  );
}

/** The wizard's start button: a bar fixed to the bottom on a phone, in the page from tablet up. */
export function RecordSiteButton({
  day,
  t,
}: {
  day: CalendarDate;
  t: Translate;
}) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 md:hidden">
        <Button asChild className="h-12 w-full text-base">
          <Link href={recordHref(day)}>
            <Plus data-icon="inline-start" />
            {t("Record a site")}
          </Link>
        </Button>
      </div>
      <Button asChild className="hidden h-12 w-full text-base md:inline-flex">
        <Link href={recordHref(day)}>
          <Plus data-icon="inline-start" />
          {t("Record a site")}
        </Link>
      </Button>
    </>
  );
}

/** The day's planned jobs; a job already logged shows Recorded and cannot be opened again. */
export function PlannedJobs({
  day,
  jobs,
  t,
}: {
  day: CalendarDate;
  jobs: readonly { work: PlannedWork; recorded: boolean }[];
  t: Translate;
}) {
  return (
    <Section title={t("Jobs planned for you")} count={jobs.length}>
      {jobs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {t("No jobs planned.")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 p-3">
          {jobs.map(({ work, recorded }) => {
            const Icon = ACTIVITY_ICON[work.activity];
            const body = (
              <>
                <Icon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{work.siteLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    {work.what}
                    {work.startTime ? ` · ${work.startTime}` : ""}
                    {work.note ? ` · ${work.note}` : ""}
                  </span>
                </span>
                <StatusBadge tone={recorded ? "good" : "info"}>
                  {recorded ? t("Recorded") : t("Tap to record")}
                </StatusBadge>
              </>
            );
            const style =
              "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm";
            return (
              <li
                key={`${work.mofId ?? work.projectId ?? work.siteName}|${work.activity}|${work.startTime}`}
              >
                {recorded ? (
                  <div className={cn(style, "bg-sunk opacity-70")}>{body}</div>
                ) : (
                  <Link
                    href={recordHref(day, work)}
                    className={cn(style, "bg-card hover:bg-sunk")}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

type SiteGroup = {
  key: string;
  label: string;
  mofNo: string | null;
  logs: MyLog[];
};

function groupBySite(logs: readonly MyLog[]): SiteGroup[] {
  const groups = new Map<string, SiteGroup>();
  for (const log of logs) {
    const key = log.mofId ?? `site:${log.siteName?.toLowerCase()}`;
    const group = groups.get(key) ?? {
      key,
      label: log.siteLabel,
      mofNo: log.mofNo,
      logs: [],
    };
    group.logs.push(log);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** What was logged on the day, one row per site with the activities done there. */
export function AlreadyRecorded({
  logs,
  t,
}: {
  logs: readonly MyLog[];
  t: Translate;
}) {
  const groups = groupBySite(logs);
  return (
    <Section title={t("Already recorded")} count={groups.length}>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {t("Nothing recorded yet.")}
        </p>
      ) : (
        <ul className="divide-y">
          {groups.map((group) => {
            const problem = group.logs.find((log) => log.problem)?.problem;
            return (
              <li key={group.key} className="flex flex-col gap-2 px-4 py-3">
                <p className="text-sm font-medium">
                  {group.mofNo && (
                    <span className="font-mono tabular-nums">
                      {group.mofNo}
                    </span>
                  )}
                  {group.mofNo && " · "}
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.logs.map((log) => (
                    <StatusBadge key={log.id} tone="info">
                      {t(SITE_ACTIVITY_LABEL[log.activity])}
                      {log.installedPct !== null && (
                        <span className="ml-1 font-mono tabular-nums">
                          {log.installedPct}%
                        </span>
                      )}
                    </StatusBadge>
                  ))}
                </div>
                {problem && <p className="text-xs text-warn">{problem}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
