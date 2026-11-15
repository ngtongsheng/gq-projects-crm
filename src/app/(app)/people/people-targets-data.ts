import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type YearTargets = {
  year: number;
  salesTarget: number | null;
  visitTarget: number | null;
};

const targetRows = z.array(
  z.object({
    profile_id: z.uuid(),
    year: z.number(),
    sales_target: z.coerce.number().nullable(),
    visit_target: z.number().nullable(),
  }),
);

/** Each person's own targets for the given years. Row-level security lets only the MD, directors and HR & Accounts read them. */
export async function loadYearlyTargets(
  years: readonly number[],
): Promise<Map<string, YearTargets[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("yearly_targets")
    .select("profile_id, year, sales_target, visit_target")
    .in("year", [...years]);
  if (error) throw new Error(`Could not load targets: ${error.message}`);
  const byPerson = new Map<string, YearTargets[]>();
  for (const row of targetRows.parse(data)) {
    byPerson.set(row.profile_id, [
      ...(byPerson.get(row.profile_id) ?? []),
      {
        year: row.year,
        salesTarget: row.sales_target,
        visitTarget: row.visit_target,
      },
    ]);
  }
  return byPerson;
}

const gradeRows = z.array(
  z.object({ grade: z.string(), annual_target: z.coerce.number().nullable() }),
);
const recordRows = z.array(
  z.object({ profile_id: z.uuid(), grade: z.string().nullable() }),
);

/** The annual target of each person's grade. Only the MD and HR & Accounts can read grades (D1). */
export async function loadGradeTargets(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const [grades, records] = await Promise.all([
    supabase.from("sales_grades").select("grade, annual_target"),
    supabase.from("staff_hr_records").select("profile_id, grade"),
  ]);
  if (grades.error) {
    throw new Error(`Could not load the grades: ${grades.error.message}`);
  }
  if (records.error) {
    throw new Error(`Could not load the grades: ${records.error.message}`);
  }
  const targetOf = new Map(
    gradeRows
      .parse(grades.data)
      .flatMap((row) =>
        row.annual_target === null ? [] : [[row.grade, row.annual_target]],
      ),
  );
  const byPerson = new Map<string, number>();
  for (const record of recordRows.parse(records.data)) {
    const target = record.grade ? targetOf.get(record.grade) : undefined;
    if (target !== undefined) byPerson.set(record.profile_id, target);
  }
  return byPerson;
}
