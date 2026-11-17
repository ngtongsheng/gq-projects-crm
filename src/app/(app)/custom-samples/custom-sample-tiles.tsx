"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/language-context";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import type {
  CustomSampleFilter,
  CustomSampleTiles,
} from "./custom-sample-filters";

/** A tile that sets the list's filter, so the number can be clicked through to its samples. */
function ClickTile({
  filter,
  onPick,
  children,
}: {
  filter: CustomSampleFilter;
  onPick: (filter: CustomSampleFilter) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(filter)}
      className="min-w-0 rounded-xl text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

/** Available, on loan, overdue, returned-to-confirm (only when there is one) and given away (demo vTuft). */
export function CustomSampleTilesRow({
  tiles,
  loanDays,
  canKeep,
  onPick,
}: {
  tiles: CustomSampleTiles;
  loanDays: number;
  canKeep: boolean;
  onPick: (filter: CustomSampleFilter) => void;
}) {
  const t = useT();
  return (
    <TileGrid className="lg:grid-cols-5">
      <StatTile
        label={t("Available")}
        value={tiles.available}
        note={t("in the office")}
      />
      <StatTile
        label={t("On loan")}
        value={tiles.onLoan}
        note={
          tiles.withMe > 0
            ? `${tiles.withMe} ${t("with you")}`
            : t("with salespeople")
        }
      />
      <ClickTile filter="overdue" onPick={onPick}>
        <StatTile
          label={t("Overdue")}
          value={
            <span className={tiles.overdue > 0 ? "text-bad" : undefined}>
              {tiles.overdue}
            </span>
          }
          note={`${t("past")} ${loanDays} ${t("days – WhatsApp to return")}`}
        />
      </ClickTile>
      {tiles.toConfirm > 0 && (
        <ClickTile filter="to-confirm" onPick={onPick}>
          <StatTile
            label={t("Returned – to confirm")}
            value={<span className="text-warn">{tiles.toConfirm}</span>}
            note={
              canKeep
                ? t("check the sample is back, then confirm")
                : t("waiting for the designer")
            }
          />
        </ClickTile>
      )}
      <StatTile
        label={t("Given away")}
        value={tiles.given}
        note={t("with reason")}
      />
    </TileGrid>
  );
}
