import { cache } from "react";
import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import { createClient } from "@/lib/supabase/server";

const peopleRows = z.array(
  z.object({
    id: z.uuid(),
    full_name: z.string().nullable(),
    job_role: JobRole,
    sells: z.boolean(),
    active: z.boolean(),
  }),
);

export type ClaimPerson = {
  id: string;
  name: string;
  jobRole: z.infer<typeof JobRole>;
  sells: boolean;
  active: boolean;
};

/**
 * Name and job role of everyone whose claim the MD or HR & Accounts settles. HR & Accounts cannot
 * read other people's profiles, so this goes through claim_people() (an embedded profiles(...)
 * select came back empty for them). Cached per request.
 */
export const loadClaimPeople = cache(
  async (): Promise<Map<string, ClaimPerson>> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_people");
    if (error) throw new Error(`Could not load the people: ${error.message}`);
    return new Map(
      peopleRows.parse(data).map((row) => [
        row.id,
        {
          id: row.id,
          name: row.full_name ?? "Unnamed",
          jobRole: row.job_role,
          sells: row.sells,
          active: row.active,
        },
      ]),
    );
  },
);
