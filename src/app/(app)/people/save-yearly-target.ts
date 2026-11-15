import type { createClient } from "@/lib/supabase/server";

export type YearlyTargetInput = {
  profileId: string;
  year: number;
  /** Empty falls back to the grade's annual target. */
  salesTarget: number | null;
  /** Empty falls back to the company default. */
  visitTarget: number | null;
};

const NOT_ALLOWED =
  "Only the Managing Director, Sales Directors and HR & Accounts can set targets.";

/**
 * Saves one person's targets for one year. Nothing set means no row, so the grade default
 * applies. The database keeps profiles.yearly_target equal to this year's effective target.
 */
export async function saveYearlyTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: YearlyTargetInput,
): Promise<string | null> {
  const { profileId, year, salesTarget, visitTarget } = target;
  const table = supabase.from("yearly_targets");
  const { error } =
    salesTarget === null && visitTarget === null
      ? await table.delete().eq("profile_id", profileId).eq("year", year)
      : await table.upsert(
          {
            profile_id: profileId,
            year,
            sales_target: salesTarget,
            visit_target: visitTarget,
          },
          { onConflict: "profile_id,year" },
        );
  if (!error) return null;
  // 42501 is the database refusing by row-level security.
  if (error.code === "42501") return NOT_ALLOWED;
  console.error("Could not save the yearly target", error);
  return "Could not save their targets. Try again.";
}
