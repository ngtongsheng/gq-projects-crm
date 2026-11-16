import { Boxes, Search } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeamMember } from "@/lib/auth/team-directory";
import {
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_KEEP_REASON_LABEL,
  LEFTOVER_UNIT_LABEL,
} from "@/lib/domain/leftover";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import type { Translate } from "@/lib/i18n/translate";
import type { Leftover } from "./leftover-data";
import { daysSince, formatDay } from "./leftover-dates";
import type { BestLinkFilters } from "./leftover-filters";
import { ShowSoldOutToggle } from "./show-sold-out-toggle";
import { UpdateLeftoverDialog } from "./update-leftover-dialog";
import { UseForProjectDialog } from "./use-for-project-dialog";

/** GQ's own stock at Best Link (the demo's Leftover list): what is left, where it came from, what it was used for. */
export function BestLinkTable({
  t,
  items,
  filters,
  onTheWay,
  canEdit,
  people,
  projects,
  suppliers,
}: {
  t: Translate;
  items: Leftover[];
  filters: BestLinkFilters;
  onTheWay: number;
  canEdit: boolean;
  people: TeamMember[];
  projects: { id: string; label: string }[];
  suppliers: string[];
}) {
  const today = todayMyt();
  const nameOf = new Map(people.map((member) => [member.id, member.name]));
  const isFiltered = filters.q !== "" || filters.soldOut;

  return (
    <section className="flex flex-col gap-3">
      <form
        action="/stock/leftover"
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <Input
          name="q"
          type="search"
          aria-label={t("Search leftover stock")}
          placeholder={t("Search item, colour or MOF")}
          defaultValue={filters.q}
          className="w-full sm:w-64"
        />
        <ShowSoldOutToggle checked={filters.soldOut} />
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          {t("Search")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {items.length} {t("items")}
          {onTheWay > 0 &&
            ` · ${onTheWay} ${t("more on the way (pending pickup)")}`}
        </span>
      </form>
      <DataTable
        rows={items}
        getRowKey={(leftover) => leftover.id}
        empty={
          <EmptyState
            icon={Boxes}
            title={
              isFiltered
                ? t("No leftover stock matches")
                : t("No leftover stock at Best Link")
            }
            description={t(
              "Comes from items marked At Best Link (for resale) below, once purchasing has them.",
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
                  {[
                    leftover.keepReason
                      ? t(LEFTOVER_KEEP_REASON_LABEL[leftover.keepReason])
                      : null,
                    leftover.orderedWrongBy
                      ? `${t("ordered by")} ${nameOf.get(leftover.orderedWrongBy) ?? t("Unnamed")}`
                      : null,
                    leftover.note || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
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
            key: "condition",
            header: t("Condition"),
            cell: (leftover) => t(LEFTOVER_CONDITION_LABEL[leftover.condition]),
          },
          {
            key: "available",
            header: t("Available"),
            numeric: true,
            cell: (leftover) => (
              <div className="flex flex-col items-end">
                <span>
                  <b>{formatQuantity(leftover.available)}</b>{" "}
                  {t(LEFTOVER_UNIT_LABEL[leftover.unit])}
                </span>
                {leftover.uses.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t("of")} {formatQuantity(leftover.qty)}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "since",
            header: t("At Best Link since"),
            className: "max-sm:hidden",
            cell: (leftover) => (
              <div className="flex flex-col">
                <span className="font-mono text-sm tabular-nums">
                  {formatDay(leftover.receivedAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {daysSince(leftover.receivedAt, today)} {t("days")}
                </span>
              </div>
            ),
          },
          {
            key: "used",
            header: t("Used for"),
            cell: (leftover) =>
              leftover.uses.length === 0 ? (
                "–"
              ) : (
                <div className="flex min-w-48 flex-col gap-0.5">
                  {leftover.uses.map((use) => (
                    <span
                      key={use.id}
                      className="text-xs text-muted-foreground"
                    >
                      {formatDate(use.usedOn)} · {formatQuantity(use.qty)}{" "}
                      {t(LEFTOVER_UNIT_LABEL[leftover.unit])} →{" "}
                      {use.projectName}
                      {use.salespersonId
                        ? ` (${nameOf.get(use.salespersonId) ?? t("Unnamed")})`
                        : ""}
                      {use.note ? ` · ${use.note}` : ""}
                    </span>
                  ))}
                </div>
              ),
          },
          {
            key: "actions",
            header: "",
            cell: (leftover) =>
              canEdit ? (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {leftover.available > 0 && (
                    <UseForProjectDialog
                      leftoverId={leftover.id}
                      item={leftover.item}
                      unit={leftover.unit}
                      available={leftover.available}
                      projects={projects}
                    />
                  )}
                  <UpdateLeftoverDialog
                    leftover={leftover}
                    people={people}
                    suppliers={suppliers}
                  />
                </div>
              ) : null,
          },
        ]}
      />
    </section>
  );
}
