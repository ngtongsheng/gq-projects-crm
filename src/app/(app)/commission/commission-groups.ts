import type { StatusTone } from "@/components/app/status-badge";
import { sumRm } from "@/lib/format/money";
import type { CommissionLine } from "./commission-data";

export type PersonGroup = {
  personId: string;
  personName: string;
  lines: CommissionLine[];
  earned: number;
  paidOut: number;
  remaining: number;
};

/** One group per person, by name; each keeps its lines in the order given. */
export function groupByPerson(lines: readonly CommissionLine[]): PersonGroup[] {
  const groups = new Map<string, CommissionLine[]>();
  for (const line of lines) {
    groups.set(line.personId, [...(groups.get(line.personId) ?? []), line]);
  }
  return [...groups.values()]
    .map((personLines) => ({
      personId: personLines[0].personId,
      personName: personLines[0].personName,
      lines: personLines,
      earned: sumRm(personLines.map((line) => line.commission.earned)),
      paidOut: sumRm(personLines.map((line) => line.balance.paidOut)),
      remaining: sumRm(personLines.map((line) => line.balance.remaining)),
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName));
}

/** The one-word state of a line, with the colour to show it in. */
export function lineStatus(line: CommissionLine): {
  label: string;
  tone: StatusTone;
} {
  const { commission, balance } = line;
  if (commission.ratePct === 0)
    return { label: "No commission", tone: "neutral" };
  if (balance.payableNow > 0) return { label: "Claimable", tone: "good" };
  if (balance.paidOut > 0 && balance.remaining === 0) {
    return { label: "Paid out", tone: "neutral" };
  }
  if (line.tier === "unknown") return { label: "Cost missing", tone: "warn" };
  return { label: `${line.pctPaid}% paid`, tone: "info" };
}
