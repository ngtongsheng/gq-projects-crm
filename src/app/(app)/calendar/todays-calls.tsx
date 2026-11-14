import { Phone } from "lucide-react";
import Link from "next/link";
import { toMytInput } from "../activities/activity-time";
import type { PlannedCall } from "./calendar-data";

/** Calls still to make today, each linking to the customer so the outcome can be logged after. */
export function TodaysCalls({ calls }: { calls: PlannedCall[] }) {
  if (calls.length === 0) return null;
  return (
    <section
      aria-label="Calls to make today"
      className="flex flex-col gap-2 rounded-lg border border-info bg-info-bg p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-medium">
        <Phone className="size-4" />
        {calls.length} {calls.length === 1 ? "call" : "calls"} to make today
      </p>
      <ul className="flex flex-wrap gap-2">
        {calls.map((call) => (
          <li key={call.id}>
            <Link
              href={`/customers/${call.contactId}`}
              className="inline-flex flex-wrap items-center gap-x-1.5 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted"
            >
              <span className="font-mono tabular-nums">
                {toMytInput(call.startsAt).slice(11)}
              </span>
              <span className="font-medium">{call.customer}</span>
              <span className="text-muted-foreground">({call.company})</span>
              <span className="font-mono tabular-nums">{call.mobile}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Open one after the call to record the outcome.
      </p>
    </section>
  );
}
