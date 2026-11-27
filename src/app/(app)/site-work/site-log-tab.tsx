import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { isManager } from "@/lib/auth/job-role";
import { startOfMonth } from "@/lib/domain/calendar-grid";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import {
  FOLLOW_UP_OWNER_LABEL,
  SITE_ACTIVITY_LABEL,
  SITE_OFF_KIND_LABEL,
  type SiteActivity,
} from "@/lib/domain/site-log";
import { measurementStatus, photosStatus } from "@/lib/domain/site-log-status";
import { awayDaysByKind, monthTally } from "@/lib/domain/site-month-tally";
import { pace as monthPace } from "@/lib/domain/workdays";
import {
  type CalendarDate,
  formatDate,
  formatMonth,
  todayMyt,
} from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { PaceBar, StatTile, TileGrid } from "../dashboard/dashboard-parts";
import { loadLeavePeople, loadLeaveRows } from "../leave/leave-data";
import { loadReportSettings } from "../reports/report-data";
import { monthParam } from "../reports/report-params";
import { MonthSwitcher } from "../reports/report-view";
import { LogStatusBadge } from "./log-status-text";
import { SegmentLinks } from "./segment-links";
import {
  loadMonthLogs,
  loadMonthOffDays,
  type MonthLog,
} from "./site-log-tab-data";

// The demo's actColor: stock returns, installation and delivery want attention, handover is done.
const ACTIVITY_TONE: Record<SiteActivity, StatusTone> = {
  stock_return: "warn",
  measurement: "info",
  inspection: "neutral",
  installation: "warn",
  delivery: "warn",
  handover: "good",
  shooting: "info",
  touch_up: "neutral",
  others: "neutral",
};

type Supervisor = { id: string; name: string };

function Sub({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}

function ActivityCell({
  log,
  nameOf,
  t,
}: {
  log: MonthLog;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const name = (personId: string | null) =>
    personId ? nameOf(personId) : null;
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge tone={ACTIVITY_TONE[log.activity]}>
        {t(SITE_ACTIVITY_LABEL[log.activity])}
      </StatusBadge>
      {log.returnAnswer && (
        <Sub
          className={cn(
            !/^No/.test(log.returnAnswer) && "font-semibold text-warn",
          )}
        >
          {`${t("Balance stock")}: ${log.returnAnswer}`}
        </Sub>
      )}
      {log.activity === "handover" && (
        <Sub>{t(log.handoverSigned ? "Form signed" : "Not signed")}</Sub>
      )}
      {(log.activity === "shooting" || log.activity === "handover") && (
        <LogStatusBadge
          t={t}
          status={photosStatus({
            activity: log.activity,
            to: name(log.photos.toId),
            postedOn: log.photos.postedOn,
            savedBy: name(log.photos.savedById),
            savedOn: log.photos.savedOn,
          })}
        />
      )}
      {log.activity === "measurement" && (
        <LogStatusBadge
          t={t}
          status={measurementStatus({
            to: name(log.measurement.toId),
            sentOn: log.measurement.sentOn,
            received: log.measurement.received,
            receivedOn: log.measurement.receivedOn,
          })}
        />
      )}
      {log.activity === "installation" && log.installedPct !== null && (
        <Sub>{`${log.installedPct}% ${t("installed")}`}</Sub>
      )}
    </div>
  );
}

/** Tiles per supervisor against their targets, then the month's visits (demo: siteLog). */
export async function SiteLogTab({
  me,
  params,
  nameOf,
  t,
}: {
  me: Profile;
  params: Record<string, string | string[] | undefined>;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const today = todayMyt();
  const current = startOfMonth(today);
  const asked = monthParam.parse(params.month);
  const month = asked && asked <= current ? asked : current;
  const manager = isManager(me.jobRole);
  const ownTile = me.jobRole === "site";

  const [logs, settings, calendar, people, offDays, leaveRows] =
    await Promise.all([
      loadMonthLogs(month),
      loadReportSettings(),
      loadWorkCalendar("mon-sat"),
      manager ? loadLeavePeople(nameOf) : [],
      manager || ownTile ? loadMonthOffDays(month) : [],
      manager || ownTile ? loadLeaveRows() : [],
    ]);

  const supervisors: Supervisor[] = manager
    ? people.filter((person) => person.jobRole === "site")
    : [...new Set(logs.map((log) => log.supervisorId))].map((id) => ({
        id,
        name: nameOf(id),
      }));
  const askedPerson = typeof params.person === "string" ? params.person : "";
  const who = ownTile
    ? me.id
    : (supervisors.find((person) => person.id === askedPerson)?.id ?? null);
  const shown = logs.filter((log) => !who || log.supervisorId === who);
  const tiled = ownTile
    ? [{ id: me.id, name: nameOf(me.id) }]
    : manager
      ? supervisors.filter((person) => !who || person.id === who)
      : [];
  const pace = month === current ? monthPace(today, calendar) : 1;
  const monthName = formatMonth(month).split(" ")[0];

  const away = (personId: string) =>
    awayDaysByKind(
      [
        ...offDays
          .filter((off) => off.profileId === personId)
          .map((off) => ({ ...off, kind: t(SITE_OFF_KIND_LABEL[off.kind]) })),
        ...leaveRows
          .filter(
            (leave) =>
              leave.personId === personId && leave.status === "approved",
          )
          .map((leave) => ({
            kind: t(LEAVE_TYPE_LABEL[leave.leaveType]),
            startsOn: leave.startsOn,
            endsOn: leave.endsOn,
          })),
      ],
      month,
      calendar,
    );
  const query = { view: "log", person: who ?? undefined };

  return (
    <div className="flex flex-col gap-4">
      {tiled.length > 0 && (
        <TileGrid className="lg:grid-cols-2 xl:grid-cols-3">
          {tiled.map((person) => {
            const tally = monthTally(logs, person.id, month);
            const open = logs
              .filter((log) => log.supervisorId === person.id)
              .flatMap((log) => log.followUps)
              .filter((followUp) => !followUp.done).length;
            const awayDays = [...away(person.id)];
            const targets = settings.targets;
            return (
              <StatTile
                key={person.id}
                label={`${person.name} · ${monthName}`}
                value={
                  <>
                    {tally.visits}
                    <small className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {targets.siteVisits} {t("site visits")}
                    </small>
                  </>
                }
                note={
                  <>
                    <b>
                      {tally.shootings}/{targets.shootings}
                    </b>{" "}
                    {t("shootings")} ·{" "}
                    <b>
                      {tally.handovers}/{targets.handovers}
                    </b>{" "}
                    {t("handover forms signed")} · <b>{tally.stockReturns}</b>{" "}
                    {t("stock returns")} · {open} {t("open actions")}
                    {awayDays.length > 0 && (
                      <span className="mt-1 block">
                        {t("Away")}:{" "}
                        {awayDays
                          .map(([kind, days]) => `${kind} ${days}d`)
                          .join(" · ")}
                      </span>
                    )}
                  </>
                }
              >
                <PaceBar
                  done={tally.visits}
                  target={targets.siteVisits}
                  pace={pace}
                  label={`${person.name} ${t("site visits")}`}
                />
              </StatTile>
            );
          })}
        </TileGrid>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <MonthSwitcher
          view={{ basePath: "/site-work", month, today }}
          query={query}
        />
        {manager && supervisors.length > 0 && (
          <SegmentLinks
            label={t("Site supervisor")}
            active={who ?? "all"}
            items={[
              {
                key: "all",
                label: t("Both supervisors"),
                href: monthHref(month, undefined),
              },
              ...supervisors.map((person) => ({
                key: person.id,
                label: person.name,
                href: monthHref(month, person.id),
              })),
            ]}
          />
        )}
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {shown.length} {t("entries")}
        </span>
      </div>
      <DataTable
        rows={shown}
        getRowKey={(log) => log.id}
        empty={
          <EmptyState
            icon={ClipboardList}
            title={`${t("No site visits logged for")} ${formatMonth(month)}.`}
          />
        }
        columns={[
          {
            key: "date",
            header: t("Date"),
            className: "whitespace-nowrap",
            cell: (log) => (
              <span className="font-mono">{formatDate(log.visitedOn)}</span>
            ),
          },
          ...(ownTile
            ? []
            : [
                {
                  key: "by",
                  header: t("By"),
                  cell: (log: MonthLog) => nameOf(log.supervisorId),
                },
              ]),
          {
            key: "site",
            header: t("MOF · Project / site"),
            cell: (log) => (
              <>
                {log.mofId ? (
                  <Link
                    href={`/site-work/${log.mofId}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {log.mofNo}
                  </Link>
                ) : (
                  <span className="font-semibold">–</span>
                )}
                <Sub>{log.siteLabel}</Sub>
              </>
            ),
          },
          {
            key: "activity",
            header: t("Activity"),
            className: "max-w-64 whitespace-normal",
            cell: (log) => <ActivityCell log={log} nameOf={nameOf} t={t} />,
          },
          {
            key: "details",
            header: t("Details"),
            className: "max-w-64 whitespace-normal",
            cell: (log) => log.details,
          },
          {
            key: "action",
            header: t("Action needed"),
            className: "max-w-64 whitespace-normal",
            cell: (log) =>
              log.followUps.length === 0
                ? "–"
                : log.followUps.map((followUp) => (
                    <div key={followUp.id}>
                      {followUp.action}
                      <Sub>
                        {`${t(FOLLOW_UP_OWNER_LABEL[followUp.ownerGroup])} · ${
                          followUp.done
                            ? t("Done")
                            : followUp.dueOn
                              ? `${t("Due")} ${formatDate(followUp.dueOn)}`
                              : t("No due date")
                        }`}
                      </Sub>
                    </div>
                  )),
          },
        ]}
      />
    </div>
  );
}

const monthHref = (month: CalendarDate, person: string | undefined) => {
  const params = new URLSearchParams({ view: "log", month: month.slice(0, 7) });
  if (person) params.set("person", person);
  return `/site-work?${params}`;
};
