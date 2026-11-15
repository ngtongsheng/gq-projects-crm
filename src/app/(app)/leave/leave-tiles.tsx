import type { LeaveBalance } from "@/lib/domain/leave-balance";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";

/** Annual leave and MC balances, and who approves, as on the demo's My leave tab. */
export function LeaveTiles({
  balance,
  approvers,
}: {
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
        label="Annual leave balance"
        value={
          balance ? (
            <>
              <span className={balance.annualBalance < 0 ? "text-bad" : ""}>
                {balance.annualBalance}
              </span>
              <small className="text-sm font-normal text-muted-foreground">
                {" "}
                / {annualTotal} days
              </small>
            </>
          ) : (
            "—"
          )
        }
        note={
          balance
            ? [
                `Taken ${balance.annualTaken}`,
                balance.annualPending > 0
                  ? `${balance.annualPending} waiting approval`
                  : null,
                balance.entitlement.carriedDays > 0
                  ? `incl. ${balance.entitlement.carriedDays} carried forward`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Balances start on 1 January 2027"
        }
      />
      <StatTile
        label="Medical leave (MC) balance"
        value={
          balance ? (
            <>
              {balance.mcBalance}
              <small className="text-sm font-normal text-muted-foreground">
                {" "}
                / {balance.entitlement.mcDays} days
              </small>
            </>
          ) : (
            "—"
          )
        }
        note={
          balance
            ? [
                `Taken ${balance.mcTaken}`,
                balance.mcPending > 0 ? `${balance.mcPending} waiting` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Balances start on 1 January 2027"
        }
      />
      <StatTile
        label="Approved by"
        value={<span className="font-sans text-base">{approvers}</span>}
        note="HR & Accounts keeps the records"
      />
    </TileGrid>
  );
}
