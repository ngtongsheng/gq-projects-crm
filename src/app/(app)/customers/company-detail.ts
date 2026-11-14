import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { customerHealth } from "@/lib/domain/customer-health";
import { formatMobile } from "@/lib/domain/mobile";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { canLogActivity } from "../activities/activity-access";
import { activityDay, getLastCompletedDays } from "../activities/last-activity";
import { ActivityStatus, ActivityType } from "../activities/schemas";
import { canAddPersonToCompany, canEditCompany } from "./contact-access";
import { AccountType, CompanyType } from "./schemas";

const SHOWN_VISITS = 10;

const companyRow = z.object({
  id: z.string(),
  name: z.string(),
  company_type: CompanyType,
  rating: z.number().int(),
  account_type: AccountType.nullable(),
  passed_by: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
});

const personRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    title: z.string().nullable(),
    mobile: z.string(),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

const visitRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    purpose: z.string(),
    outcome: z.string().nullable(),
    starts_at: z.string(),
    status: ActivityStatus,
  }),
);

/** A company with its people and latest visits, or null when it is gone or hidden from the viewer. */
export async function loadCompanyDetail(me: Profile, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, company_type, rating, account_type, passed_by, address, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load company: ${error.message}`);
  if (!data) return null;
  const company = companyRow.parse(data);

  const [peopleResult, lastVisits, team] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, title, mobile, contact_owners(profile_id)")
      .eq("company_id", id)
      .is("archived_at", null)
      .order("name"),
    getLastCompletedDays(supabase),
    getTeamDirectory(),
  ]);
  if (peopleResult.error) {
    throw new Error(
      `Could not load the company's people: ${peopleResult.error.message}`,
    );
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const today = todayMyt();
  const people = personRows.parse(peopleResult.data).map((row) => {
    const ownerIds = row.contact_owners.map((owner) => owner.profile_id);
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      mobile: formatMobile(row.mobile),
      health: customerHealth(lastVisits.get(row.id) ?? null, today),
      ownerIds,
      ownerNames: ownerIds.map((ownerId) => nameOf.get(ownerId) ?? "Unnamed"),
    };
  });

  const personIds = people.map((person) => person.id);
  const visitsResult =
    personIds.length === 0
      ? null
      : await supabase
          .from("activities")
          .select(
            "id, contact_id, owner_id, type, purpose, outcome, starts_at, status",
          )
          .in("contact_id", personIds)
          .neq("status", "cancelled")
          .order("starts_at", { ascending: false });
  if (visitsResult?.error) {
    throw new Error(`Could not load visits: ${visitsResult.error.message}`);
  }
  const personName = new Map(people.map((person) => [person.id, person.name]));
  const visits = visitRows.parse(visitsResult?.data ?? []).map((row) => ({
    id: row.id,
    day: activityDay(row.starts_at),
    ownerName: nameOf.get(row.owner_id) ?? "Unnamed",
    type: row.type,
    status: row.status,
    personName: personName.get(row.contact_id) ?? "Unnamed",
    purpose: row.purpose,
    outcome: row.outcome,
  }));

  const salespeopleIds = [...new Set(people.flatMap((p) => p.ownerIds))];
  return {
    company: {
      id: company.id,
      name: company.name,
      companyType: company.company_type,
      rating: company.rating,
      accountType: company.account_type,
      passedBy: company.passed_by ?? "",
      address: company.address ?? "",
      notes: company.notes ?? "",
    },
    salespeopleNames: salespeopleIds.map(
      (ownerId) => nameOf.get(ownerId) ?? "Unnamed",
    ),
    people,
    visits: visits.slice(0, SHOWN_VISITS),
    visitCount: visits.length,
    team,
    canEdit: canEditCompany(me.jobRole),
    canAddPerson: canAddPersonToCompany(me.jobRole, salespeopleIds, me.id),
    canLogVisit: canLogActivity(me.jobRole) && people.length > 0,
  };
}

export type CompanyDetail = NonNullable<
  Awaited<ReturnType<typeof loadCompanyDetail>>
>;
