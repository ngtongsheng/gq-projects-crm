import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import {
  ALLOWANCE_TYPES,
  HOTEL_LEVELS,
  type OutstationRules,
  type StaffPackage,
  type StandardPackages,
} from "@/lib/domain/staff-package";
import { createClient } from "@/lib/supabase/server";

const allowanceList = z.array(
  z.object({ name: z.enum(ALLOWANCE_TYPES), amount: z.number() }),
);

const packageRows = z.array(
  z.object({
    id: z.uuid(),
    profile_id: z.uuid(),
    effective_on: z.iso.date(),
    basic: z.coerce.number(),
    allowances: allowanceList,
    claim_cap: z.coerce.number().nullable(),
    hotel_level: z.enum(HOTEL_LEVELS).nullable(),
    reason: z.string(),
    added_by: z.uuid(),
  }),
);

/** Every recorded package row, the whole history; row-level security lets only the MD and HR & Accounts read them. */
async function loadPackages(): Promise<StaffPackage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_packages")
    .select(
      "id, profile_id, effective_on, basic, allowances, claim_cap, hotel_level, reason, added_by",
    );
  if (error) throw new Error(`Could not load packages: ${error.message}`);
  return packageRows.parse(data).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    effectiveOn: row.effective_on,
    basic: row.basic,
    allowances: row.allowances,
    claimCap: row.claim_cap,
    hotelLevel: row.hotel_level,
    reason: row.reason,
    addedBy: row.added_by,
  }));
}

export type StaffHrRecord = {
  grade: string | null;
  confirmedOn: string | null;
  offerLetterLink: string | null;
  note: string;
};

const recordRows = z.array(
  z.object({
    profile_id: z.uuid(),
    grade: z.string().nullable(),
    confirmed_on: z.iso.date().nullable(),
    offer_letter_link: z.string().nullable(),
    note: z.string(),
  }),
);

async function loadHrRecords(): Promise<Map<string, StaffHrRecord>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_hr_records")
    .select("profile_id, grade, confirmed_on, offer_letter_link, note");
  if (error) throw new Error(`Could not load HR records: ${error.message}`);
  return new Map(
    recordRows.parse(data).map((row) => [
      row.profile_id,
      {
        grade: row.grade,
        confirmedOn: row.confirmed_on,
        offerLetterLink: row.offer_letter_link,
        note: row.note,
      },
    ]),
  );
}

const standardRows = z.array(
  z.object({
    position: z.enum(["sales", "site"]),
    allowances: allowanceList,
    claim_cap: z.coerce.number().nullable(),
  }),
);

async function loadStandardPackages(): Promise<StandardPackages> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("standard_packages")
    .select("position, allowances, claim_cap");
  if (error) {
    throw new Error(`Could not load the standard packages: ${error.message}`);
  }
  const standards: StandardPackages = {
    sales: { allowances: [], claimCap: null },
    site: { allowances: [], claimCap: null },
  };
  for (const row of standardRows.parse(data)) {
    standards[row.position] = {
      allowances: row.allowances,
      claimCap: row.claim_cap,
    };
  }
  return standards;
}

const outstationRow = z.object({
  breakfast: z.coerce.number(),
  lunch: z.coerce.number(),
  dinner: z.coerce.number(),
  hotel_staff: z.coerce.number(),
  hotel_manager: z.coerce.number(),
  hotel_director: z.coerce.number(),
});

async function loadOutstationRules(): Promise<OutstationRules> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outstation_rules")
    .select(
      "breakfast, lunch, dinner, hotel_staff, hotel_manager, hotel_director",
    )
    .single();
  if (error) {
    throw new Error(`Could not load the outstation rules: ${error.message}`);
  }
  const row = outstationRow.parse(data);
  return {
    breakfast: row.breakfast,
    lunch: row.lunch,
    dinner: row.dinner,
    hotel: {
      staff: row.hotel_staff,
      manager: row.hotel_manager,
      director: row.hotel_director,
    },
  };
}

export type StaffPerson = {
  id: string;
  jobRole: JobRole;
  joinedOn: string | null;
};

const personRows = z.array(
  z.object({
    id: z.uuid(),
    job_role: JobRole,
    joined_on: z.iso.date().nullable(),
  }),
);

/** Everyone still here except the MD, who has no package (demo hrStaff). leave_people() is the list HR may read profiles through. */
async function loadStaffPeople(): Promise<StaffPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leave_people");
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  return personRows
    .parse(data)
    .filter((row) => row.job_role !== "md")
    .map((row) => ({
      id: row.id,
      jobRole: row.job_role,
      joinedOn: row.joined_on,
    }));
}

/** Everything the Staff packages view shows, read together. */
export async function loadStaffData() {
  const [people, packages, records, standards, outstation] = await Promise.all([
    loadStaffPeople(),
    loadPackages(),
    loadHrRecords(),
    loadStandardPackages(),
    loadOutstationRules(),
  ]);
  return { people, packages, records, standards, outstation };
}
