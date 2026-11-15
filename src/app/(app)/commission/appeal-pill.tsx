import { StatusBadge } from "@/components/app/status-badge";
import type { CommissionAppeal } from "./appeals-data";

/** Where a person's late-cut appeal stands, shown on their commission row and in the Appeals tab. */
export function AppealPill({ appeal }: { appeal: CommissionAppeal }) {
  if (appeal.status === "approved") {
    return (
      <span
        title={`${appeal.reply ?? ""} A favour, not the usual rule.`.trim()}
      >
        <StatusBadge tone="good">
          Special approval by {appeal.decidedByName}
        </StatusBadge>
      </span>
    );
  }
  if (appeal.status === "pending") {
    return <StatusBadge tone="info">Appeal sent, waiting</StatusBadge>;
  }
  return (
    <span title={appeal.reply ?? undefined}>
      <StatusBadge tone="bad">Appeal rejected</StatusBadge>
    </span>
  );
}
