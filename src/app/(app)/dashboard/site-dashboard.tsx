import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { attentionItems } from "@/lib/domain/attention";
import {
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
} from "@/lib/domain/delivery-status";
import {
  BOOKING_PURPOSE_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
} from "@/lib/domain/site-booking";
import { pace as monthPace } from "@/lib/domain/workdays";
import { addDays, formatDate, todayMyt } from "@/lib/format/date";
import {
  loadCalendarBookings,
  loadPendingBookingDays,
} from "../installation/booking-data";
import { loadCalendarJobs } from "../installation/calendar-jobs";
import {
  loadActiveSites,
  loadPendingClaims,
} from "../site-work/site-work-data";
import {
  AttentionPanel,
  PaceBar,
  Panel,
  PanelEmpty,
  StatTile,
  TileGrid,
} from "./dashboard-parts";
import { loadOwnMonth } from "./report-snapshot";

const LOOKAHEAD_DAYS = 14;

/** A Site Supervisor's day on a phone: bookings to answer, this fortnight's jobs and visits, and the month's targets. */
export async function SiteDashboard({ me }: { me: Profile }) {
  const today = todayMyt();
  const until = addDays(today, LOOKAHEAD_DAYS);
  const [own, bookings, pendingDays, jobs, sites, claims, team] =
    await Promise.all([
      loadOwnMonth(me, today),
      loadCalendarBookings(today, until, me.id),
      loadPendingBookingDays(me.id),
      loadCalendarJobs(today, until, me.id),
      loadActiveSites(today),
      loadPendingClaims(me),
      getTeamDirectory(),
    ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const stats = own?.stats.kind === "site" ? own.stats : null;
  const paceNow = monthPace(today);
  const withFollowUps = sites
    .filter((site) => site.openFollowUps > 0)
    .sort((a, b) => b.overdueFollowUps - a.overdueFollowUps);

  const attention = attentionItems(me.jobRole, {
    pendingBookings: pendingDays.length,
    overdueFollowUps: sites.reduce(
      (total, site) => total + site.overdueFollowUps,
      0,
    ),
    claimsToVerify: claims.length,
    ownReport: own?.reportOverdue ? 1 : 0,
  });

  return (
    <div className="flex flex-col gap-4">
      <AttentionPanel items={attention} />
      {stats ? (
        <TileGrid className="grid-cols-2">
          <StatTile label="Site visits" value={stats.siteVisits}>
            <PaceBar
              done={stats.siteVisits}
              target={stats.siteVisitTarget}
              pace={paceNow}
              label="Site visits against target"
            />
          </StatTile>
          <StatTile label="Shootings" value={stats.shootings}>
            <PaceBar
              done={stats.shootings}
              target={stats.shootingTarget}
              pace={paceNow}
              label="Photo and video shootings against target"
            />
          </StatTile>
          <StatTile label="Handovers signed" value={stats.handovers}>
            <PaceBar
              done={stats.handovers}
              target={stats.handoverTarget}
              pace={paceNow}
              label="Signed handover forms against target"
            />
          </StatTile>
          <StatTile
            label="Overtime hours"
            value={stats.otHours}
            note="This month, rejected claims left out"
          />
        </TileGrid>
      ) : null}
      <Panel
        title="Bookings"
        aside={
          <Link href="/installation" className="hover:underline">
            Installation Calendar
          </Link>
        }
      >
        {bookings.length === 0 ? (
          <PanelEmpty>No bookings in the next two weeks.</PanelEmpty>
        ) : (
          <ul className="divide-y">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDate(booking.visitOn)} · {booking.startTime}
                  </span>
                  <StatusBadge tone={BOOKING_STATUS_TONE[booking.status]}>
                    {BOOKING_STATUS_LABEL[booking.status]}
                  </StatusBadge>
                </div>
                <p className="font-medium">
                  {BOOKING_PURPOSE_LABEL[booking.purpose]}
                  {booking.siteLabel ? `: ${booking.siteLabel}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Asked by {nameOf.get(booking.requestedBy) ?? "Unnamed"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Jobs in the next two weeks">
        {jobs.length === 0 ? (
          <PanelEmpty>
            No jobs assigned to you in the next two weeks.
          </PanelEmpty>
        ) : (
          <ul className="divide-y">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDate(job.scheduledOn)}
                    {job.startTime ? ` · ${job.startTime}` : ""}
                  </span>
                  <StatusBadge tone={JOB_STATUS_TONE[job.status]}>
                    {JOB_STATUS_LABEL[job.status]}
                  </StatusBadge>
                </div>
                <p className="font-medium">
                  {JOB_TYPE_LABEL[job.jobType]}: {job.projectName}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono tabular-nums">{job.mofNo}</span> ·{" "}
                  {job.companyName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Sites with open follow-ups"
        aside={
          <Link href="/site-work" className="hover:underline">
            Site Work
          </Link>
        }
      >
        {withFollowUps.length === 0 ? (
          <PanelEmpty>No open follow-ups on any site.</PanelEmpty>
        ) : (
          <ul className="divide-y">
            {withFollowUps.slice(0, 8).map((site) => (
              <li key={site.id}>
                <Link
                  href={`/site-work/${site.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-sunk"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {site.projectName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">
                        {site.mofNo}
                      </span>{" "}
                      · {site.companyName}
                    </span>
                  </span>
                  <StatusBadge
                    tone={site.overdueFollowUps > 0 ? "bad" : "info"}
                  >
                    {site.overdueFollowUps > 0
                      ? `${site.overdueFollowUps} overdue`
                      : `${site.openFollowUps} open`}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
