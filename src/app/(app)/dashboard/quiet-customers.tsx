import Link from "next/link";
import { z } from "zod";
import { StatusBadge } from "@/components/app/status-badge";
import {
  CustomerHealthLabel,
  customerHealth,
} from "@/lib/domain/customer-health";
import { type CalendarDate, daysBetween, formatDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { getLastCompletedDays } from "../activities/last-activity";
import { Panel, PanelEmpty } from "./dashboard-parts";

const SHOWN = 7;

const ownedRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    companies: z.object({ name: z.string() }),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

/** The person's customers with no completed activity for over 60 days, longest quiet first. */
async function loadQuietCustomers(personId: string, today: CalendarDate) {
  const supabase = await createClient();
  const [contacts, lastActivity] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, companies(name), contact_owners!inner(profile_id)")
      .eq("contact_owners.profile_id", personId)
      .is("archived_at", null),
    getLastCompletedDays(supabase),
  ]);
  if (contacts.error) {
    throw new Error(`Could not load customers: ${contacts.error.message}`);
  }
  return ownedRows
    .parse(contacts.data)
    .flatMap((row) => {
      const last = lastActivity.get(row.id) ?? null;
      const health = customerHealth(last, today);
      return last && (health === "quiet" || health === "no_activity")
        ? [
            {
              id: row.id,
              name: row.name,
              companyName: row.companies.name,
              last,
              health,
              idleDays: daysBetween(last, today),
            },
          ]
        : [];
    })
    .sort((a, b) => b.idleDays - a.idleDays);
}

/** Your customers going quiet: time for a visit before they cool off. */
export async function QuietCustomers({
  personId,
  today,
}: {
  personId: string;
  today: CalendarDate;
}) {
  const quiet = await loadQuietCustomers(personId, today);
  return (
    <Panel title="Visit these soon" aside={`${quiet.length} going quiet`}>
      {quiet.length === 0 ? (
        <PanelEmpty>
          All your customers had a completed visit or call in the last 60 days.
        </PanelEmpty>
      ) : (
        <ul className="divide-y">
          {quiet.slice(0, SHOWN).map((customer) => (
            <li
              key={customer.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <Link
                href={`/customers/${customer.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="truncate font-medium">
                  {customer.name} · {customer.companyName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Last activity {formatDate(customer.last)}
                </p>
              </Link>
              <StatusBadge
                tone={customer.health === "no_activity" ? "bad" : "warn"}
              >
                {CustomerHealthLabel[customer.health]}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
