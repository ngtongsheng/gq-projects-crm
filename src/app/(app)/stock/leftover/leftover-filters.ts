import type { Leftover } from "./leftover-data";

export type BestLinkFilters = { q: string; soldOut: boolean };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const parseBestLinkFilters = (
  params: Record<string, string | string[] | undefined>,
): BestLinkFilters => ({
  q: first(params.q)?.trim() ?? "",
  soldOut: first(params.sold) === "1",
});

/**
 * The items at Best Link the Leftover list shows: newest arrival first, matching the search on
 * item, note, MOF or project, and sold-out items only when asked for (the demo's "Show sold out").
 */
export function selectBestLinkItems(
  leftovers: readonly Leftover[],
  filters: BestLinkFilters,
): Leftover[] {
  const needle = filters.q.toLowerCase();
  return leftovers
    .filter((leftover) => leftover.status === "at_best_link")
    .filter((leftover) => filters.soldOut || leftover.available > 0)
    .filter(
      (leftover) =>
        needle === "" ||
        [leftover.item, leftover.note, leftover.mofNo, leftover.projectName]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/** Items GQ keeps that are still waiting for pickup: "more on the way" under the Best Link list. */
export const countOnTheWay = (leftovers: readonly Leftover[]) =>
  leftovers.filter(
    (leftover) =>
      leftover.status === "pending_pickup" && leftover.destination === "gq",
  ).length;

/** Everything not at Best Link: items still moving, and the finished ones. Waiting for pickup first. */
export const returnsInProgress = (leftovers: readonly Leftover[]) =>
  leftovers.filter((leftover) => leftover.status !== "at_best_link");
