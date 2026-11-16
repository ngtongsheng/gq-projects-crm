import { Boxes } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import type { TeamMember } from "@/lib/auth/team-directory";
import {
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_KEEP_REASON_LABEL,
  LEFTOVER_UNIT_LABEL,
  leftoverTransportState,
} from "@/lib/domain/leftover";
import { formatQuantity } from "@/lib/format/quantity";
import type { Translate } from "@/lib/i18n/translate";
import { ArrangeTransportDialog } from "./arrange-transport-dialog";
import { LeftoverBadges } from "./leftover-badges";
import type { Leftover } from "./leftover-data";
import { formatDay } from "./leftover-dates";
import { LeftoverProgress } from "./leftover-progress";
import { UpdateLeftoverDialog } from "./update-leftover-dialog";

/** Items still on their way back from site, and the ones already returned, kept or disposed of. */
export function ReturnsTable({
  t,
  items,
  canEdit,
  people,
  suppliers,
}: {
  t: Translate;
  items: Leftover[];
  canEdit: boolean;
  people: TeamMember[];
  suppliers: string[];
}) {
  const nameOf = new Map(people.map((member) => [member.id, member.name]));
  const toArrange = items.filter(
    (leftover) => leftoverTransportState(leftover) === "to_arrange",
  );

  return (
    <DataTable
      rows={items}
      getRowKey={(leftover) => leftover.id}
      empty={
        <EmptyState
          icon={Boxes}
          title={t("No returns to follow up")}
          description={t(
            "A site supervisor records leftover items from the site's page under Site Work.",
          )}
        />
      }
      columns={[
        {
          key: "item",
          header: t("Item"),
          cell: (leftover) => (
            <div className="flex min-w-48 flex-col">
              <span className="font-medium">{leftover.item}</span>
              <span className="text-xs text-muted-foreground">
                {t(LEFTOVER_CONDITION_LABEL[leftover.condition])} ·{" "}
                {t(LEFTOVER_DESTINATION_LABEL[leftover.destination])}
              </span>
              {(leftover.supplier || leftover.keepReason) && (
                <span className="text-xs text-muted-foreground">
                  {leftover.supplier ??
                    (leftover.keepReason
                      ? t(LEFTOVER_KEEP_REASON_LABEL[leftover.keepReason])
                      : "")}
                  {leftover.orderedWrongBy
                    ? ` · ${t("ordered by")} ${nameOf.get(leftover.orderedWrongBy) ?? t("Unnamed")}`
                    : ""}
                </span>
              )}
              {leftover.note && (
                <span className="text-xs text-muted-foreground">
                  {leftover.note}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "site",
          header: t("From job"),
          cell: (leftover) => (
            <Link
              href={`/site-work/${leftover.mofId}`}
              className="flex flex-col hover:underline"
            >
              <span className="font-mono text-sm">{leftover.mofNo}</span>
              <span className="text-xs text-muted-foreground">
                {leftover.projectName}
              </span>
            </Link>
          ),
        },
        {
          key: "qty",
          header: t("Qty"),
          numeric: true,
          cell: (leftover) =>
            `${formatQuantity(leftover.qty)} ${LEFTOVER_UNIT_LABEL[leftover.unit]}`,
        },
        {
          key: "status",
          header: t("Status"),
          cell: (leftover) => {
            const sameSite = toArrange.filter(
              (other) => other.mofId === leftover.mofId,
            );
            return (
              <div className="flex min-w-48 flex-col gap-1">
                <LeftoverBadges t={t} leftover={leftover} />
                <LeftoverProgress t={t} leftover={leftover} nameOf={nameOf} />
                {canEdit &&
                  leftoverTransportState(leftover) === "to_arrange" && (
                    <span>
                      <ArrangeTransportDialog
                        leftoverIds={sameSite.map((other) => other.id)}
                        summary={`${leftover.mofNo} · ${leftover.projectName} · ${sameSite
                          .map(
                            (other) =>
                              `${formatQuantity(other.qty)} ${LEFTOVER_UNIT_LABEL[other.unit]} ${other.item}`,
                          )
                          .join(", ")}`}
                        deliverTo={
                          leftover.destination === "gq"
                            ? "Best Link"
                            : (leftover.supplier ?? "")
                        }
                      />
                    </span>
                  )}
              </div>
            );
          },
        },
        {
          key: "recorded",
          header: t("Recorded"),
          className: "max-sm:hidden",
          cell: (leftover) => (
            <div className="flex flex-col">
              <span className="font-mono text-sm tabular-nums">
                {formatDay(leftover.recordedOn)}
              </span>
              <span className="text-xs text-muted-foreground">
                {leftover.recordedBy
                  ? (nameOf.get(leftover.recordedBy) ?? t("Unnamed"))
                  : ""}
              </span>
            </div>
          ),
        },
        {
          key: "actions",
          header: "",
          cell: (leftover) =>
            canEdit ? (
              <UpdateLeftoverDialog
                leftover={leftover}
                people={people}
                suppliers={suppliers}
              />
            ) : null,
        },
      ]}
    />
  );
}
