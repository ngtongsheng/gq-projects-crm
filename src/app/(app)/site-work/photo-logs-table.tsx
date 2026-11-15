import { Camera } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import type { Profile } from "@/lib/auth/current-profile";
import { photosStatus } from "@/lib/domain/site-log-status";
import { canMarkPhotosPosted, canSaveToDrive } from "@/lib/domain/site-photos";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { LogStatusBadge } from "./log-status-text";
import { PostedNowButton } from "./row-action-buttons";
import { SaveToDriveDialog } from "./save-to-drive-dialog";
import type { PhotoLog } from "./site-photos-data";
import { SubText } from "./sub-text";

/** Where a log's photos stand, with the Drive folder once there is one. */
export function PhotoStatus({
  log,
  nameOf,
  t,
}: {
  log: PhotoLog;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const name = (personId: string | null) =>
    personId ? nameOf(personId) : null;
  return (
    <>
      <LogStatusBadge
        t={t}
        status={photosStatus({
          activity: log.activity,
          to: name(log.toId),
          postedOn: log.postedOn,
          savedBy: name(log.savedById),
          savedOn: log.savedOn,
        })}
      />
      {log.driveLink && (
        <SubText>
          <a
            href={log.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {t("Open Drive folder")}
          </a>
        </SubText>
      )}
    </>
  );
}

/**
 * The tracker for one kind of photos: every handover's completed photos, or every shooting.
 * The supervisor taps Posted now, then sales support saves them into Drive (demo: siteShots).
 */
export function PhotoLogsTable({
  logs,
  kind,
  me,
  nameOf,
  t,
}: {
  logs: readonly PhotoLog[];
  kind: "shooting" | "handover";
  me: Profile;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const shown = logs.filter((log) => log.activity === kind);
  // The job's folder is usually the same every time, so the last link saved for it is offered.
  const linkFor = (log: PhotoLog) =>
    log.driveLink ??
    logs.find((other) => other.mofId === log.mofId && other.driveLink)
      ?.driveLink ??
    "";
  const photos = kind === "handover" ? t("completed photos") : t("shooting");

  return (
    <DataTable
      rows={shown}
      getRowKey={(log) => log.id}
      empty={
        <EmptyState
          icon={Camera}
          title={t(
            kind === "handover"
              ? "No handovers logged yet."
              : "No shootings yet.",
          )}
        />
      }
      columns={[
        {
          key: "date",
          header: t(kind === "handover" ? "Handover" : "Shot"),
          className: "whitespace-nowrap",
          cell: (log) => (
            <>
              <span className="font-mono">{formatDate(log.visitedOn)}</span>
              <SubText>{nameOf(log.supervisorId)}</SubText>
            </>
          ),
        },
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
              <SubText>
                {[log.siteLabel, kind === "shooting" && log.details]
                  .filter(Boolean)
                  .join(" · ")}
              </SubText>
            </>
          ),
        },
        ...(kind === "shooting"
          ? [
              {
                key: "support",
                header: t("Support"),
                className: "max-sm:hidden",
                cell: (log: PhotoLog) => (log.toId ? nameOf(log.toId) : "–"),
              },
            ]
          : []),
        {
          key: "status",
          header: t("Status"),
          cell: (log) => <PhotoStatus log={log} nameOf={nameOf} t={t} />,
        },
        {
          key: "action",
          header: "",
          cell: (log) => {
            if (!log.postedOn) {
              return canMarkPhotosPosted(me, log) ? (
                <PostedNowButton siteLogId={log.id} />
              ) : null;
            }
            if (!canSaveToDrive(me, log)) return null;
            return (
              <SaveToDriveDialog
                siteLogId={log.id}
                summary={[
                  log.mofNo,
                  log.siteLabel,
                  `${photos} ${formatDate(log.visitedOn)}`,
                  nameOf(log.supervisorId),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                initialLink={linkFor(log)}
                saved={log.savedOn !== null}
              />
            );
          },
        },
      ]}
    />
  );
}
