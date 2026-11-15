import { BellRing } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/current-profile";
import { isSnoozed } from "@/lib/domain/follow-up-snooze";
import {
  ACTION_GROUP_FILTERS,
  type ActionGroupFilter,
  actionDueState,
  byDueDate,
  inActionGroup,
  openActionCounts,
  parseActionGroup,
} from "@/lib/domain/site-action-list";
import { canChaseFollowUp, FOLLOW_UP_OWNER_LABEL } from "@/lib/domain/site-log";
import { formatDate, todayMyt } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { FollowUpDoneButton, StillWaitingDialog } from "./follow-up-parts";
import { SegmentLinks } from "./segment-links";
import { loadSiteActions, type SiteAction } from "./site-action-data";

const actionsHref = (group: ActionGroupFilter, completed: boolean) => {
  const params = new URLSearchParams({ view: "actions" });
  if (group !== "all") params.set("owner", group);
  if (completed) params.set("done", "1");
  return `/site-work?${params}`;
};

function ActionState({
  action,
  today,
  t,
}: {
  action: SiteAction;
  today: string;
  t: Translate;
}) {
  if (action.doneAt) return <StatusBadge tone="good">{t("Done")}</StatusBadge>;
  const state = actionDueState(action, today);
  if (state === "no-date") {
    return <StatusBadge>{t("No due date")}</StatusBadge>;
  }
  return (
    <StatusBadge tone={state === "overdue" ? "bad" : "warn"}>
      {`${t(state === "overdue" ? "Overdue" : "Due")} ${formatDate(action.dueOn ?? today)}`}
    </StatusBadge>
  );
}

function ActionItem({
  action,
  me,
  today,
  nameOf,
  t,
}: {
  action: SiteAction;
  me: Profile;
  today: string;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const snoozed = isSnoozed(action.wait, today);
  const canChase = canChaseFollowUp(me, action);
  const target = {
    mofId: action.mofId,
    followUpId: action.id,
    ownerGroup: action.ownerGroup,
    assigneeId: action.assigneeId,
  };
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{action.action}</span>
        <span className="text-xs text-muted-foreground">
          <b className="font-semibold text-foreground">
            {t(FOLLOW_UP_OWNER_LABEL[action.ownerGroup])}
          </b>{" "}
          {t("to act")}
          {action.assigneeId && ` · ${nameOf(action.assigneeId)}`}
          {" · "}
          {action.mofId ? (
            <Link
              href={`/site-work/${action.mofId}`}
              className="underline-offset-2 hover:underline"
            >
              {action.mofNo}
            </Link>
          ) : (
            "–"
          )}
          {action.siteLabel && ` · ${action.siteLabel}`}
          {action.salespersonId &&
            ` · ${t("salesperson")} ${nameOf(action.salespersonId)}`}
          {` · ${t("raised by")} ${nameOf(action.raisedBy)} ${t("on")} ${formatDate(action.raisedOn)}`}
        </span>
        {action.doneAt ? (
          <span className="text-xs text-muted-foreground">
            {t("Done")}
            {action.doneBy && ` ${t("by")} ${nameOf(action.doneBy)}`}{" "}
            {formatDate(action.doneAt.slice(0, 10))}
          </span>
        ) : (
          action.wait && (
            <span className="text-xs text-muted-foreground">
              {t("Waiting")}: {action.wait.note}
              {snoozed &&
                ` · ${t("chase again")} ${formatDate(action.wait.snoozedUntil)}`}
            </span>
          )
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ActionState action={action} today={today} t={t} />
        {!action.doneAt && canChase && (
          <>
            <FollowUpDoneButton {...target} />
            <StillWaitingDialog {...target} />
          </>
        )}
      </div>
    </li>
  );
}

/**
 * What site visits left for someone to do, filtered by who has to act (demo: siteActions).
 * Management, the supervisors, the support team and the project's salesperson see it; whoever
 * owns an action, or is assigned it, can mark it done or still waiting.
 */
export async function ActionsTab({
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
  const group = parseActionGroup(params.owner);
  const completed = params.done === "1";
  const [open, finished] = await Promise.all([
    loadSiteActions(false),
    completed ? loadSiteActions(true) : Promise.resolve([]),
  ]);
  const counts = openActionCounts(open);
  const inGroup = (completed ? finished : open).filter((action) =>
    inActionGroup(action, group),
  );
  const shown = completed ? inGroup : inGroup.sort(byDueDate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-heading text-lg font-semibold">
          {t(
            completed
              ? "Completed actions"
              : "Actions needed after site visits",
          )}
        </h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {shown.length}
        </span>
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link href={actionsHref(group, !completed)}>
            {t(completed ? "Show open" : "Show completed")}
          </Link>
        </Button>
      </div>
      <SegmentLinks
        label={t("Who has to act")}
        active={group}
        items={ACTION_GROUP_FILTERS.map((key) => ({
          key,
          label: `${t(key === "all" ? "Everyone" : FOLLOW_UP_OWNER_LABEL[key])}${counts[key] ? ` (${counts[key]})` : ""}`,
          href: actionsHref(key, completed),
        }))}
      />
      <div className="rounded-xl border bg-card">
        {shown.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title={t(completed ? "Nothing completed yet." : "No open actions.")}
          />
        ) : (
          <ul className="divide-y">
            {shown.map((action) => (
              <ActionItem
                key={action.id}
                action={action}
                me={me}
                today={today}
                nameOf={nameOf}
                t={t}
              />
            ))}
          </ul>
        )}
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          {t(
            "Everyone except marketing sees these, so anyone can remind the installer or the client. Whoever owns an action, is assigned it, or a manager can mark it done.",
          )}
        </p>
      </div>
    </div>
  );
}
