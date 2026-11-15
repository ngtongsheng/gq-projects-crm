import { z } from "zod";
import { SALES_GRADES } from "@/lib/domain/hr-scheme";
import { createClient } from "@/lib/supabase/server";
import { loadPolicyDocuments, loadSchemeGrades } from "./policy-data";
import { loadPackages, loadStaffPeople } from "./staff-data";

export type GradeRecord = {
  grade: string | null;
  appendixSignedOn: string | null;
  appendixVersion: string | null;
};

const recordRows = z.array(
  z.object({
    profile_id: z.uuid(),
    grade: z.enum(SALES_GRADES).nullable(),
    appendix_signed_on: z.iso.date().nullable(),
    appendix_version: z.string().nullable(),
  }),
);

async function loadGradeRecords(): Promise<Map<string, GradeRecord>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_hr_records")
    .select("profile_id, grade, appendix_signed_on, appendix_version");
  if (error) throw new Error(`Could not load the grades: ${error.message}`);
  return new Map(
    recordRows.parse(data).map((row) => [
      row.profile_id,
      {
        grade: row.grade,
        appendixSignedOn: row.appendix_signed_on,
        appendixVersion: row.appendix_version,
      },
    ]),
  );
}

/** Everything the Sales grades & bonus view shows, read together. */
export async function loadGradesData() {
  const [grades, people, packages, records, documents] = await Promise.all([
    loadSchemeGrades(),
    loadStaffPeople(),
    loadPackages(),
    loadGradeRecords(),
    loadPolicyDocuments(),
  ]);
  return { grades, people, packages, records, documents };
}
