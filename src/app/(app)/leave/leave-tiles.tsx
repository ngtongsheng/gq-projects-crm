import type { LeaveBalance } from "@/lib/domain/leave-balance";
import type { Translate } from "@/lib/i18n/translate";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";

/** Annual leave and MC balances, and who approves, as on the demo's My leave tab. */
export function LeaveTiles({
  balance,
  approvers,
  t,
}: {
  t: Translate;
  /** Null before balances start (1 January 2027). */
  balance: LeaveBalance | null;
  approvers: string;
}) {
  const annualTotal = balance
    ? balance.entitlement.annualDays + balance.entitlement.carriedDays
    : 0;
  return (
    <TileGrid>
      <StatTile
        label={t("Annual leave balance")}
        value={
          balance ? (
            <>
              <span className={balance.annualBalance < 0 ? "text-bad" : ""}>
                {balance.annualBalance}
              </span>
              <small className="text-sm font-normal text-muted-foreground">
                {" "}
                / {annualTotal} {t("days")}
              </small>
            </>
          ) : (
            "—"
          )
        }
        note={
          balance
            ? [
                `${t("Taken")} ${balance.annualTaken}`,
                balance.annualPending > 0
                  ? `${balance.annualPending} ${t("waiting approval")}`
                  : null,
                balance.entitlement.carriedDays > 0
                  ? `${t("incl.")} ${balance.entitlement.carriedDays} ${t("carried forward")}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : t("Balances start on 1 January 2027")
        }
      />
      <StatTile
        label={t("Medical leave (MC) balance")}
        value={
          balance ? (
            <>
              {balance.mcBalance}
              <small className="text-sm font-normal text-muted-foreground">
                {" "}
                / {balance.entitlement.mcDays} {t("days")}
              </small>
            </>
          ) : (
            "—"
          )
        }
        note={
          balance
            ? [
                `${t("Taken")} ${balance.mcTaken}`,
                balance.mcPending > 0
                  ? `${balance.mcPending} ${t("waiting")}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : t("Balances start on 1 January 2027")
        }
      />
      <StatTile
        label={t("Approved by")}
        value={<span className="font-sans text-base">{approvers}</span>}
        note={t("HR & Accounts keeps the records")}
      />
    </TileGrid>
  );
}
