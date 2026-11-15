import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { getLastCompletedDays } from "../activities/last-activity";
import { buildCompanyRows } from "./company-rows";
import { AccountType, CompanyType } from "./schemas";

const companyRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    company_type: CompanyType,
    rating: z.number().int(),
    account_type: AccountType.nullable(),
  }),
);

const personRows = z.array(
  z.object({
    id: z.string(),
    company_id: z.string(),
    name: z.string(),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

/** Every company the signed-in person may read, with its people, salespeople and last visit. */
export async function loadCompanies() {
  const supabase = await createClient();
  const [companiesResult, peopleResult, lastVisits, team] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, company_type, rating, account_type")
      .order("name"),
    supabase
      .from("contacts")
      .select("id, company_id, name, contact_owners(profile_id)")
      .is("archived_at", null),
    getLastCompletedDays(supabase),
    getTeamDirectory(),
  ]);
  if (companiesResult.error) {
    throw new Error(
      `Could not load companies: ${companiesResult.error.message}`,
    );
  }
  if (peopleResult.error) {
    throw new Error(
      `Could not load people at companies: ${peopleResult.error.message}`,
    );
  }

  return buildCompanyRows(
    companyRows.parse(companiesResult.data).map((row) => ({
      id: row.id,
      name: row.name,
      companyType: row.company_type,
      rating: row.rating,
      accountType: row.account_type,
    })),
    personRows.parse(peopleResult.data).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      ownerIds: row.contact_owners.map((owner) => owner.profile_id),
    })),
    lastVisits,
    new Map(team.map((member) => [member.id, member.name])),
    todayMyt(),
  );
}
