import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { customerHealth } from "@/lib/domain/customer-health";
import { formatMobile } from "@/lib/domain/mobile";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { getLastCompletedDays } from "../activities/last-activity";
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
    rating: z.number().int(),
    account_type: AccountType,
    passed_by: z.string().nullable(),
    notes: z.string().nullable(),
    companies: z.object({ name: z.string(), company_type: CompanyType }),
    contact_owners: z.array(z.object({ profile_id: z.string() })),
  }),
);

/** Every live customer, by name, as the signed-in person's access lets them see it. */
export async function loadCustomers(me: Profile) {
  const supabase = await createClient();
  const [contactsResult, lastActivity, team] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, company_id, name, mobile, title, rating, account_type, passed_by, notes, companies(name, company_type), contact_owners(profile_id)",
      )
      .is("archived_at", null)
      .order("name"),
    getLastCompletedDays(supabase),
    getTeamDirectory(),
  ]);
  if (contactsResult.error) {
    throw new Error(
      `Could not load customers: ${contactsResult.error.message}`,
    );
  }
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const today = todayMyt();
  return contactRows.parse(contactsResult.data).map((row) => {
    const ownerIds = row.contact_owners.map((owner) => owner.profile_id);
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      mobile: row.mobile,
      companyName: row.companies.name,
      companyType: row.companies.company_type,
      rating: row.rating,
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
        rating: row.rating,
        accountType: row.account_type,
        passedBy: row.passed_by ?? "",
        notes: row.notes ?? "",
      },
      canEdit: canEditContact(me.jobRole, ownerIds.includes(me.id)),
      canRequest: canRequestOwnership(me.jobRole, ownerIds.includes(me.id)),
    };
  });
}
