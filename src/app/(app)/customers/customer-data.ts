import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  daysWithoutVisit,
  lastVisitByCompany,
  releaseCutoff,
  releasedCompanyIds,
} from "@/lib/domain/company-release";
import { customerHealth } from "@/lib/domain/customer-health";
import { formatMobile } from "@/lib/domain/mobile";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { activityDay, getLastCompletedDays } from "../activities/last-activity";
import { canEditContact } from "./contact-access";
import { canRequestOwnership } from "./ownership/ownership-access";
import { AccountType, CompanyType } from "./schemas";

const contactRows = z.array(
  z.object({
    id: z.string(),
    company_id: z.string(),
    name: z.string(),
    mobile: z.string(),
    title: z.string().nullable(),
    account_type: AccountType,
    passed_by: z.string().nullable(),
    notes: z.string().nullable(),
    companies: z.object({
      name: z.string(),
      company_type: CompanyType,
      rating: z.number().int(),
    }),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

const visitRows = z.array(
  z.object({ contact_id: z.string(), starts_at: z.string() }),
);

const PAGE = 1000;

/** Every completed visit and site visit, day by customer, read a page at a time past the row cap. */
async function loadCompletedVisits(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ contactId: string; day: CalendarDate }[]> {
  const visits: { contactId: string; day: CalendarDate }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("activities")
      .select("contact_id, starts_at")
      .eq("status", "completed")
      .in("type", ["visit", "site_visit"])
      .order("starts_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load visits: ${error.message}`);
    const rows = visitRows.parse(data);
    visits.push(
      ...rows.map((row) => ({
        contactId: row.contact_id,
        day: activityDay(row.starts_at),
      })),
    );
    if (rows.length < PAGE) return visits;
  }
}

const companyRows = z.array(
  z.object({ id: z.string(), created_at: z.string() }),
);

/** Every live customer, by name, as the signed-in person's access lets them see it. */
export async function loadCustomers(me: Profile) {
  const supabase = await createClient();
  const today = todayMyt();
  const [contactsResult, lastActivity, team, visitsResult, companiesResult] =
    await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id, company_id, name, mobile, title, account_type, passed_by, notes, companies(name, company_type, rating), contact_owners(profile_id)",
        )
        .is("archived_at", null)
        .order("name"),
      getLastCompletedDays(supabase),
      getTeamDirectory(),
      loadCompletedVisits(supabase),
      supabase.from("companies").select("id, created_at"),
    ]);
  if (contactsResult.error) {
    throw new Error(
      `Could not load customers: ${contactsResult.error.message}`,
    );
  }
  if (companiesResult.error) {
    throw new Error(
      `Could not load companies: ${companiesResult.error.message}`,
    );
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const contacts = contactRows.parse(contactsResult.data);
  const people = contacts.map((row) => ({
    id: row.id,
    companyId: row.company_id,
  }));
  const companyAddedOn = new Map(
    companyRows
      .parse(companiesResult.data)
      .map((company) => [company.id, activityDay(company.created_at)]),
  );
  const lastVisit = lastVisitByCompany(people, visitsResult);
  // Visits in the last 90 days are what keep a company from being released.
  const cutoff = releaseCutoff(today);
  const releasedCompanies = releasedCompanyIds({
    contacts: people,
    visitedContactIds: visitsResult
      .filter((visit) => visit.day >= cutoff)
      .map((visit) => visit.contactId),
    companyAddedOn,
    today,
  });

  return contacts.map((row) => {
    const ownerIds = row.contact_owners.map((owner) => owner.profile_id);
    return {
      id: row.id,
      companyId: row.company_id,
      /** No completed visit to the company for 90 days: open for other salespeople to ask for. */
      released: releasedCompanies.has(row.company_id),
      /** Days since the company's last completed visit, or since it was added when never visited. */
      daysWithoutVisit: daysWithoutVisit(
        {
          addedOn: companyAddedOn.get(row.company_id) ?? today,
          lastVisit: lastVisit.get(row.company_id) ?? null,
        },
        today,
      ),
      everVisited: lastVisit.has(row.company_id),
      name: row.name,
      title: row.title,
      mobile: row.mobile,
      companyName: row.companies.name,
      companyType: row.companies.company_type,
      rating: row.companies.rating,
      accountType: row.account_type,
      health: customerHealth(lastActivity.get(row.id) ?? null, today),
      ownerIds,
      ownerNames: ownerIds.map((id) => nameOf.get(id) ?? "Unnamed"),
      editable: {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        mobile: formatMobile(row.mobile),
        title: row.title ?? "",
        accountType: row.account_type,
        passedBy: row.passed_by ?? "",
        notes: row.notes ?? "",
      },
      canEdit: canEditContact(me.jobRole, ownerIds.includes(me.id)),
      canRequest: canRequestOwnership(me.jobRole, ownerIds.includes(me.id)),
    };
  });
}
