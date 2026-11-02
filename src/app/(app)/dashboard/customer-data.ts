import { z } from "zod";
import { customerHealth } from "@/lib/domain/customer-health";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { getLastCompletedDays } from "../activities/last-activity";

const rows = z.array(
  z.object({
    id: z.string(),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

/** Owners of every customer with no completed activity for over 90 days, one entry per customer. */
export async function loadInactiveCustomerOwners(
  today: CalendarDate,
): Promise<string[][]> {
  const supabase = await createClient();
  const [contacts, lastActivity] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, contact_owners(profile_id)")
      .is("archived_at", null),
    getLastCompletedDays(supabase),
  ]);
  if (contacts.error) {
    throw new Error(`Could not load customers: ${contacts.error.message}`);
  }
  return rows
    .parse(contacts.data)
    .filter(
      (row) =>
        customerHealth(lastActivity.get(row.id) ?? null, today) ===
        "no_activity",
    )
    .map((row) => row.contact_owners.map((owner) => owner.profile_id));
}
