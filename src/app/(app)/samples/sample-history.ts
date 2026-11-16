import {
  formatPickupNo,
  formatSampleQty,
  type SampleUnit,
} from "@/lib/domain/samples";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import type { SampleMoveRow } from "./samples-data";

/** One line of a sample's history, newest first (demo: the History list in the edit sheet). */
export function describeMove(
  move: SampleMoveRow,
  unit: SampleUnit,
  nameOf: ReadonlyMap<string, string>,
): { date: string; text: string } {
  const who = move.takenBy ? (nameOf.get(move.takenBy) ?? "Unnamed") : "";
  const form = move.pickupNo ? ` · ${formatPickupNo(move.pickupNo)}` : "";
  const forWhom = move.forWhom ? ` for ${move.forWhom}` : "";

  if (move.kind === "adjust") {
    return {
      // Counts have no day of their own; the day they were written, Malaysian time.
      date: formatDate(todayMyt(new Date(move.createdAt))),
      text:
        move.qtyBefore === 0 && move.qty > 0
          ? `Added ${formatSampleQty(move.qty, unit)}`
          : `Qty ${formatQuantity(move.qtyBefore)} → ${formatSampleQty(move.qty, unit)}`,
    };
  }
  if (move.kind === "kept") {
    return {
      date: formatDate(move.movedOn),
      text: `${formatSampleQty(move.qty, unit)} given to ${move.forWhom || "client"} to keep${who ? ` · by ${who}` : ""}`,
    };
  }
  return {
    date: formatDate(move.movedOn),
    text: `${formatSampleQty(move.qty, unit)} taken out${who ? ` by ${who}` : ""}${forWhom}${form}${move.backOn ? ` · back ${formatDate(move.backOn)}` : ""}`,
  };
}
