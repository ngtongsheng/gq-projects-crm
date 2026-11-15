import { BellRing, CalendarClock, ClipboardX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  FOLLOW_UP_OWNER_LABEL,
  SITE_OFF_KIND_LABEL,
} from "@/lib/domain/site-log";
import type { PlannedWork } from "@/lib/domain/site-plan";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import {
  FollowUpDoneButton,
  StillWaitingDialog,
} from "../site-work/follow-up-parts";
import { AwayChooser, type LeaveSheetProps } from "./away-chooser";
import type { OpenFollowUp } from "./open-follow-ups";
import { recordHref } from "./record-link";
import { RemoveAwayButton } from "./remove-away-button";
import type { SiteOffDay } from "./today-data";

const TONE = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  info: "bg-info-bg text-info",
} as const;

function Banner({
  tone,
  title,
  icon,
  children,
}: {
  tone: keyof typeof TONE;
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 text-sm",
        TONE[tone],
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {icon && <span aria-hidden>{icon}</span>}
        {title}
      </p>
      {children}
    </div>
  );
}

/** Past site days with nothing logged: log the day, or say why not. */
export function MissedDaysBanner({
  days,
  leave,
  t,
}: {
  days: readonly CalendarDate[];
  leave: LeaveSheetProps;
  t: Translate;
}) {
  if (days.length === 0) return null;
  return (
    <Banner
      tone="bad"
      title={`${t("You have not recorded your work for")}:`}
      icon={<ClipboardX className="size-4" />}
    >
      <ul className="flex flex-col gap-2">
        {days.map((day) => (
          <li key={day} className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/today?date=${day}`}>
                {formatDate(day)} · {t("Record now")}
              </Link>
            </Button>
            <AwayChooser day={day} leave={leave} compact />
          </li>
        ))}
      </ul>
    </Banner>
  );
}

/** Jobs the calendar planned in the past week that have no log. */
export function PlannedNotRecordedBanner({
  jobs,
  t,
}: {
  jobs: readonly PlannedWork[];
  t: Translate;
}) {
  if (jobs.length === 0) return null;
  return (
    <Banner
      tone="warn"
      title={`${t("Planned jobs not recorded")}:`}
      icon={<CalendarClock className="size-4" />}
    >
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => (
          <li
            key={`${job.day}|${job.mofId ?? job.projectId ?? job.siteName}|${job.activity}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span className="min-w-0">
              <span className="font-mono tabular-nums">
                {formatDate(job.day)}
              </span>{" "}
              · {job.siteLabel} · {job.what}
            </span>
            <Button asChild size="sm">
              <Link href={recordHref(job.day, job)}>{t("Record now")}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </Banner>
  );
}

/** The follow-ups that are this person's to chase, each with Done and Still waiting. */
export function FollowUpBanner({
  followUps,
  today,
  t,
}: {
  followUps: readonly OpenFollowUp[];
  today: CalendarDate;
  t: Translate;
}) {
  if (followUps.length === 0) return null;
  const dueNow = followUps.filter(
    (followUp) => followUp.dueOn !== null && followUp.dueOn <= today,
  ).length;
  return (
    <Banner
      tone={dueNow > 0 ? "bad" : "warn"}
      title={`${t("Follow up")} (${followUps.length})${dueNow > 0 ? ` · ${dueNow} ${t("due now")}` : ""}`}
      icon={<BellRing className="size-4" />}
    >
      <ul className="flex flex-col gap-3">
        {followUps.map((followUp) => (
          <li key={followUp.id} className="flex flex-col gap-2">
            <span className="min-w-0">
              <span className="font-medium">{followUp.action}</span>
              <span className="block text-xs opacity-80">
                {followUp.siteLabel && `${followUp.siteLabel} · `}
                {t(FOLLOW_UP_OWNER_LABEL[followUp.ownerGroup])}
                {followUp.dueOn && ` · ${formatDate(followUp.dueOn)}`}
              </span>
              {followUp.wait && (
                <span className="block text-xs opacity-80">
                  {t("Waiting")}: {followUp.wait.note}
                </span>
              )}
            </span>
            <span className="flex flex-wrap gap-2">
              <FollowUpDoneButton {...followUpTarget(followUp)} />
              <StillWaitingDialog {...followUpTarget(followUp)} />
            </span>
          </li>
        ))}
      </ul>
    </Banner>
  );
}

const followUpTarget = (followUp: OpenFollowUp) => ({
  mofId: followUp.mofId,
  followUpId: followUp.id,
  ownerGroup: followUp.ownerGroup,
  assigneeId: followUp.assigneeId,
});

/** The selected day is already marked away: an office or other day can be taken back out. */
export function AwayDayBanners({
  day,
  off,
  leaveLabel,
  t,
}: {
  day: CalendarDate;
  off: readonly SiteOffDay[];
  /** The approved leave covering the day, e.g. "Medical leave (MC)", or null. */
  leaveLabel: string | null;
  t: Translate;
}) {
  return (
    <>
      {leaveLabel && (
        <Banner tone="info" title={`${leaveLabel} · ${formatDate(day)}`} />
      )}
      {off.map((entry) => (
        <Banner
          key={entry.id}
          tone="info"
          title={`${t(SITE_OFF_KIND_LABEL[entry.kind])} · ${formatDate(day)}${entry.note ? ` · ${entry.note}` : ""}`}
        >
          <div>
            <RemoveAwayButton id={entry.id} />
          </div>
        </Banner>
      ))}
    </>
  );
}

/** From 17:00 on a site day with nothing logged. */
export function EndOfDayBanner({ t }: { t: Translate }) {
  return (
    <Banner
      tone="warn"
      title={t("Before you go home, record today's work.")}
      icon={<ClipboardX className="size-4" />}
    />
  );
}
