import type { ReactNode } from "react";
import type { Profile } from "@/lib/auth/current-profile";
import { isManager } from "@/lib/auth/job-role";
import { snoozeUntil } from "@/lib/domain/follow-up-snooze";
import { canRequestShoot } from "@/lib/domain/site-photos";
import { weekKindFor } from "@/lib/domain/workdays";
import { todayMyt } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { loadSiteSupervisors } from "../installation/booking-data";
import { PhotoLogsTable } from "./photo-logs-table";
import { ShootRequestDialog } from "./shoot-request-dialog";
import { ShootRequestsTable } from "./shoot-requests-table";
import type { SiteJob } from "./site-jobs-data";
import { loadPhotoLogs, loadShootRequests } from "./site-photos-data";

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Photos & videos: the shooting requests, every handover's completed photos and every
 * shooting. Photos are posted in the job's WhatsApp group, never uploaded here; sales support
 * saves them into Drive and pastes the folder link (demo: siteShots).
 */
export async function PhotosTab({
  me,
  jobs,
  nameOf,
  t,
}: {
  me: Profile;
  jobs: readonly SiteJob[];
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const today = todayMyt();
  const canRequest = canRequestShoot(me.jobRole);
  const [requests, logs, supervisors, calendar] = await Promise.all([
    loadShootRequests(),
    loadPhotoLogs(),
    canRequest ? loadSiteSupervisors() : [],
    canRequest ? loadWorkCalendar(weekKindFor(me.jobRole)) : null,
  ]);

  // A salesperson asks for their own jobs; managers, BD and marketing for any.
  const askable =
    me.jobRole === "sales"
      ? jobs.filter((job) => job.salespersonId === me.id)
      : isManager(me.jobRole) ||
          me.jobRole === "bd" ||
          me.jobRole === "marketing"
        ? jobs
        : [];

  const unposted = (kind: "shooting" | "handover") =>
    logs.filter((log) => log.activity === kind && !log.postedOn).length;
  const toSave = (kind: "shooting" | "handover") =>
    logs.filter((log) => log.activity === kind && log.postedOn && !log.savedOn)
      .length;
  const counted = (kind: "shooting" | "handover", noun: string) =>
    `${unposted(kind)} ${t(noun)} · ${toSave(kind)} ${t("to save into Drive")}`;

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("Shooting wanted")}
        count={`${requests.filter((request) => request.status === "requested").length} ${t("open")} · ${t("job sites we want good photos or video of")}`}
        action={
          canRequest && calendar ? (
            <ShootRequestDialog
              mofs={askable.map((job) => ({
                id: job.id,
                label: `${job.mofNo} · ${job.projectName}`,
              }))}
              supervisors={supervisors.map((person) => ({
                id: person.id,
                label: person.name,
              }))}
              today={today}
              defaultDue={snoozeUntil(today, 5, calendar)}
            />
          ) : null
        }
      >
        <ShootRequestsTable
          requests={requests}
          logs={logs}
          me={me}
          today={today}
          nameOf={nameOf}
          t={t}
        />
      </Section>
      <Section
        title={t("Completed photos (every handover, min. 4)")}
        count={counted("handover", "not posted")}
      >
        <PhotoLogsTable
          logs={logs}
          kind="handover"
          me={me}
          nameOf={nameOf}
          t={t}
        />
      </Section>
      <Section
        title={t("Photo & video shootings")}
        count={counted("shooting", "not submitted")}
      >
        <PhotoLogsTable
          logs={logs}
          kind="shooting"
          me={me}
          nameOf={nameOf}
          t={t}
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "Photos and videos are posted in the job site WhatsApp group, not uploaded here. Sales support saves them into the Google Drive job site folder, pastes the folder link and taps Saved to Drive.",
          )}
        </p>
      </Section>
    </div>
  );
}
