import { StatusBadge } from "@/components/app/status-badge";
import {
  LEFTOVER_RETURN_METHOD_LABEL,
  leftoverTransportState,
} from "@/lib/domain/leftover";
import { formatDate } from "@/lib/format/date";
import type { Leftover } from "./leftover-data";
import { formatDay } from "./leftover-dates";

const MOVING = new Set(["pending_pickup", "collected_by_supervisor"]);

/**
 * Where an item is on its way back: how it goes, the transport, whether the office has the
 * WhatsApp, who collected it and who received it (the demo's status cell).
 */
export function LeftoverProgress({
  leftover,
  nameOf,
}: {
  leftover: Leftover;
  nameOf: ReadonlyMap<string, string>;
}) {
  const transport = leftoverTransportState(leftover);
  const person = (id: string | null) =>
    id ? (nameOf.get(id) ?? "Unnamed") : "";
  const moving = MOVING.has(leftover.status);
  const lines: string[] = [];

  if (leftover.returnMethod && transport !== "to_arrange") {
    const label = LEFTOVER_RETURN_METHOD_LABEL[leftover.returnMethod];
    lines.push(
      transport === "arranged" && leftover.transportOn
        ? `${leftover.transportBy} ${formatDate(leftover.transportOn)}${leftover.transportTo ? ` to ${leftover.transportTo}` : ""}`
        : label,
    );
  }
  if (leftover.collectedBy && leftover.collectedAt) {
    lines.push(
      `${person(leftover.collectedBy)} collected ${formatDay(leftover.collectedAt)}${leftover.collectedTo ? ` · ${leftover.collectedTo}` : ""}`,
    );
  }
  if (
    leftover.receivedBy &&
    (leftover.status === "returned_to_supplier" ||
      leftover.status === "at_best_link")
  ) {
    lines.push(
      `Received by ${person(leftover.receivedBy)} ${formatDay(leftover.receivedAt)}`,
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {transport === "to_arrange" && (
        <span>
          <StatusBadge tone="bad">Transport to arrange</StatusBadge>
        </span>
      )}
      {lines.map((line) => (
        <span key={line} className="text-xs text-muted-foreground">
          {line}
        </span>
      ))}
      {leftover.collectedBy &&
        !leftover.collectedTo &&
        leftover.status === "collected_by_supervisor" && (
          <span className="text-xs font-medium text-warn">
            Purchasing to record where it went
          </span>
        )}
      {moving && leftover.returnMethod && (
        <span
          className={
            leftover.whatsappSentAt
              ? "text-xs text-muted-foreground"
              : "text-xs font-medium text-warn"
          }
        >
          {leftover.whatsappSentAt
            ? "Office WhatsApped"
            : "Office not WhatsApped yet"}
        </span>
      )}
    </div>
  );
}
