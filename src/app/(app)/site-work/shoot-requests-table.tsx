import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import {
  canCancelShootRequest,
  dueState,
  SHOOT_KIND_LABEL,
} from "@/lib/domain/site-photos";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { PhotoStatus } from "./photo-logs-table";
import { CancelRequestButton } from "./row-action-buttons";
import type { PhotoLog, ShootRequest } from "./site-photos-data";
import { SubText } from "./sub-text";

function DueTag({
  dueOn,
  today,
  t,
}: {
  dueOn: CalendarDate;
  today: CalendarDate;
  t: Translate;
}) {
  const state = dueState(dueOn, today);
  return (
    <SubText
      className={cn(
        state === "overdue" && "font-bold text-bad",
        state === "today" && "font-bold text-warn",
      )}
    >
      {state === "today"
        ? t("Due today")
        : `${state === "overdue" ? `${t("Overdue")} · ` : ""}${t("due")} ${formatDate(dueOn)}`}
    </SubText>
  );
}

/** The requests for good photos or video, with who shot them and where the photos got to. */
export function ShootRequestsTable({
  requests,
  logs,
  me,
  today,
  nameOf,
  t,
}: {
  requests: ShootRequest[];
  logs: readonly PhotoLog[];
  me: Profile;
  today: CalendarDate;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  // The shooting that answered a request is the first one at that MOF since it was asked.
  const shotFor = (request: ShootRequest) =>
    logs
      .filter(
        (log) =>
          log.activity === "shooting" &&
          log.mofId === request.mofId &&
          log.visitedOn >= request.createdOn,
      )
      .sort((a, b) => a.visitedOn.localeCompare(b.visitedOn))[0];

  return (
    <DataTable
      rows={requests}
      getRowKey={(request) => request.id}
      empty={
        <EmptyState
          icon={Clapperboard}
          title={t("No shooting requests.")}
          description={t(
            "Salespeople, Marketing, the MD or the Sales Director can request one.",
          )}
        />
      }
      columns={[
        {
          key: "site",
          header: t("MOF · Project"),
          cell: (request) => (
            <>
              <Link
                href={`/site-work/${request.mofId}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                {request.mofNo}
              </Link>
              <SubText>
                {[request.projectName, request.note]
                  .filter(Boolean)
                  .join(" · ")}
              </SubText>
            </>
          ),
        },
        {
          key: "what",
          header: t("What"),
          cell: (request) => (
            <>
              {t(SHOOT_KIND_LABEL[request.kind])}
              {request.status === "requested" && (
                <DueTag dueOn={request.dueOn} today={today} t={t} />
              )}
              {request.bestOn && (
                <SubText>{`${t("best")} ${formatDate(request.bestOn)}`}</SubText>
              )}
              {request.supervisorId && (
                <SubText>{nameOf(request.supervisorId)}</SubText>
              )}
            </>
          ),
        },
        {
          key: "by",
          header: t("Asked by"),
          className: "max-sm:hidden",
          cell: (request) => (
            <>
              {nameOf(request.createdById)}
              <SubText>{formatDate(request.createdOn)}</SubText>
            </>
          ),
        },
        {
          key: "status",
          header: t("Status"),
          cell: (request) => {
            if (request.status !== "done") {
              return (
                <StatusBadge tone="warn">
                  {t("Waiting for site supervisor")}
                </StatusBadge>
              );
            }
            const shot = shotFor(request);
            return (
              <>
                <StatusBadge tone="good">
                  {[
                    t("Shot"),
                    request.doneOn && formatDate(request.doneOn),
                    request.doneById && `· ${nameOf(request.doneById)}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </StatusBadge>
                {shot && (
                  <div className="mt-1">
                    <PhotoStatus log={shot} nameOf={nameOf} t={t} />
                  </div>
                )}
              </>
            );
          },
        },
        {
          key: "action",
          header: "",
          cell: (request) =>
            request.status === "requested" &&
            canCancelShootRequest(me, request) && (
              <CancelRequestButton
                requestId={request.id}
                createdById={request.createdById}
              />
            ),
        },
      ]}
    />
  );
}
