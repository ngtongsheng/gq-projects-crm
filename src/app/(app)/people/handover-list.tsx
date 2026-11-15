import { FieldDescription, FieldTitle } from "@/components/ui/field";
import { formatDate } from "@/lib/format/date";
import type { HandoverEntry } from "./handover-data";

/** What this person handed over when they left, or received from someone who left. */
export function HandoverList({ entries }: { entries: HandoverEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <FieldTitle>Handover list</FieldTitle>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map((entry, index) => (
          <li
            // The same customer can reach someone twice (from two leavers), so the key needs the index.
            key={`${entry.kind}-${entry.name}-${index}`}
            className="flex flex-wrap justify-between gap-x-4"
          >
            <span>
              {entry.kind === "customer" ? "Customer" : "Project"} ·{" "}
              {entry.name}
            </span>
            <span className="text-muted-foreground">
              {entry.gave ? "To" : "From"} {entry.otherName} ·{" "}
              {formatDate(entry.handedOverOn)}
            </span>
          </li>
        ))}
      </ul>
      <FieldDescription>
        Commission on their orders stays with whoever sold them.
      </FieldDescription>
    </div>
  );
}
