import { z } from "zod";
import {
  releaseCutoff,
  releasedCompanyIds,
} from "@/lib/domain/company-release";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { activityDay } from "../activities/last-activity";

const contactRows = z.array(
  z.object({ id: z.string(), company_id: z.string() }),
);
const visitRows = z.array(z.object({ contact_id: z.string() }));
const companyRows = z.array(
  z.object({ id: z.string(), created_at: z.string() }),
);

/** How many companies nobody has visited for 3 months: the number the MD and Sales Director act on. */
export async function countReleasedCompanies(
  today: CalendarDate,
): Promise<number> {
  const supabase = await createClient();
  const [contacts, visits, companies] = await Promise.all([
    supabase.from("contacts").select("id, company_id").is("archived_at", null),
    supabase
      .from("activities")
      .select("contact_id")
      .eq("status", "completed")
      .in("type", ["visit", "site_visit"])
      .gte("starts_at", `${releaseCutoff(today)}T00:00:00+08:00`),
    supabase.from("companies").select("id, created_at"),
  ]);
  for (const result of [contacts, visits, companies]) {
    if (result.error) {
      throw new Error(
        `Could not count released companies: ${result.error.message}`,
      );
    }
  }
  return releasedCompanyIds({
    contacts: contactRows
      .parse(contacts.data)
      .map((row) => ({ id: row.id, companyId: row.company_id })),
    visitedContactIds: visitRows
      .parse(visits.data)
      .map((visit) => visit.contact_id),
    companyAddedOn: new Map(
      companyRows
        .parse(companies.data)
        .map((company) => [company.id, activityDay(company.created_at)]),
    ),
    today,
  }).size;
}
