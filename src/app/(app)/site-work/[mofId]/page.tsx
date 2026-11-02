import { ChevronLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canEditSite, type JobRole } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { canRecordLeftover, LEFTOVER_UNIT_LABEL } from "@/lib/domain/leftover";
import { MOF_STAGE_LABEL, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import {
  canCloseFollowUp,
  FOLLOW_UP_OWNER_LABEL,
  isFollowUpOverdue,
  SITE_ACTIVITY_LABEL,
} from "@/lib/domain/site-log";
import { formatDate, formatDateTime, todayMyt } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import { cn } from "@/lib/utils";
import { LeftoverBadges } from "../../stock/leftover/leftover-badges";
import { loadLeftovers } from "../../stock/leftover/leftover-data";
import { RecordLeftoverDialog } from "../../stock/leftover/record-leftover-dialog";
import { FollowUpCheck, FollowUpDialog } from "../follow-up-parts";
import { SiteLogDialog } from "../site-log-dialog";
import { SiteStageSelect } from "../site-stage-select";
import { loadSite, type SiteLog } from "../site-work-data";
import { StageProgress } from "../stage-progress";

export const metadata: Metadata = { title: "Site Work" };

type FollowUpListProps = {
  mofId: string;
  log: SiteLog;
  jobRole: JobRole;
  today: string;
  nameOf: ReadonlyMap<string, string>;
};

function FollowUpList({
  mofId,
  log,
  jobRole,
  today,
  nameOf,
}: FollowUpListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {log.followUps.map((followUp) => {
        const overdue = isFollowUpOverdue(followUp, today);
        return (
          <li key={followUp.id} className="flex items-start gap-2.5">
            <div className="pt-0.5">
              <FollowUpCheck
                mofId={mofId}
                followUpId={followUp.id}
                ownerGroup={followUp.ownerGroup}
                done={followUp.done}
                label={`Done: ${followUp.action}`}
                canClose={canCloseFollowUp(jobRole, followUp.ownerGroup)}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-sm",
                  followUp.done && "text-muted-foreground line-through",
                )}
              >
                {followUp.action}
              </span>
              <span className="text-xs text-muted-foreground">
                {FOLLOW_UP_OWNER_LABEL[followUp.ownerGroup]}
                {followUp.dueOn && (
                  <>
                    {" · due "}
                    <span className={cn(overdue && "font-medium text-bad")}>
                      {formatDate(followUp.dueOn)}
                      {overdue && " (overdue)"}
                    </span>
                  </>
                )}
                {followUp.done &&
                  followUp.doneAt &&
                  ` · done ${formatDateTime(followUp.doneAt)}${followUp.doneBy ? ` by ${nameOf.get(followUp.doneBy) ?? "Unnamed"}` : ""}`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ mofId: string }>;
}) {
  const me = await requireSection("siteWork");
  const { mofId } = await params;
  if (!z.uuid().safeParse(mofId).success) notFound();

  const [loaded, team, leftovers] = await Promise.all([
    loadSite(mofId),
    getTeamDirectory(),
    loadLeftovers(mofId),
  ]);
  if (!loaded) notFound();
  const { site, logs } = loaded;

  const today = todayMyt();
  const canEdit = canEditSite(me.jobRole);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/site-work"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        All sites
      </Link>
      <PageHeader
        title={site.projectName}
        description={`${site.mofNo} · ${site.companyName}${site.siteAddress ? ` · ${site.siteAddress}` : ""}`}
        actions={
          <>
            <StatusBadge tone={MOF_STAGE_TONE[site.mofStage]}>
              {MOF_STAGE_LABEL[site.mofStage]}
            </StatusBadge>
            {canEdit && <SiteLogDialog mofId={site.id} today={today} />}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Site stage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StageProgress stage={site.siteStage} />
          {canEdit && (
            <SiteStageSelect mofId={site.id} stage={site.siteStage} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Leftover stock</h2>
          {canRecordLeftover(me) && <RecordLeftoverDialog mofId={site.id} />}
        </div>
        {leftovers.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              title="No leftover stock recorded"
              description="Record anything left over after the job so purchasing can collect it."
            />
          </div>
        ) : (
          <Card>
            <CardContent>
              <ul className="flex flex-col divide-y">
                {leftovers.map((leftover) => (
                  <li
                    key={leftover.id}
                    className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-medium">
                        {leftover.item}
                      </span>
                      <span className="font-mono text-sm tabular-nums">
                        {formatQuantity(leftover.qty)}{" "}
                        {LEFTOVER_UNIT_LABEL[leftover.unit]}
                      </span>
                    </div>
                    <LeftoverBadges leftover={leftover} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Site visits</h2>
        {logs.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              title="No visits logged yet"
              description={
                canEdit
                  ? "Log a visit after each time you are on site."
                  : "The site supervisor logs each visit here."
              }
            />
          </div>
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-heading font-semibold">
                    {SITE_ACTIVITY_LABEL[log.activity]}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">
                    {formatDate(log.visitedOn)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    · {nameOf.get(log.supervisorId) ?? "Unnamed"}
                  </span>
                </div>
                {log.notes && (
                  <p className="text-sm whitespace-pre-line">{log.notes}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {log.measurementReceived && (
                    <StatusBadge tone="good">Measurement received</StatusBadge>
                  )}
                  {log.handoverSigned && (
                    <StatusBadge tone="good">Handover signed</StatusBadge>
                  )}
                  {log.driveLink && (
                    <a
                      href={log.driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
                    >
                      Open in Drive
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                {log.followUps.length > 0 && (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Follow-ups
                    </span>
                    <FollowUpList
                      mofId={site.id}
                      log={log}
                      jobRole={me.jobRole}
                      today={today}
                      nameOf={nameOf}
                    />
                  </div>
                )}
                {canEdit && (
                  <div>
                    <FollowUpDialog mofId={site.id} siteLogId={log.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
