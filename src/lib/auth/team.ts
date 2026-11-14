import { canLeadTeam, type JobRole } from "./job-role";

export type TeamPerson = {
  id: string;
  jobRole: JobRole;
  reportsTo: string | null;
};

/** Profile ids whose sales records I see, or null for everyone (SQL: public.my_team()). */
export function myTeam(
  me: Pick<TeamPerson, "id" | "jobRole">,
  people: readonly TeamPerson[],
): string[] | null {
  if (me.jobRole === "md" || me.jobRole === "accounts") return null;
  if (!canLeadTeam(me.jobRole)) return [me.id];
  const members = people
    .filter((p) => p.jobRole === "sales" && p.reportsTo === me.id)
    .map((p) => p.id);
  return [me.id, ...members];
}

/** SQL: public.in_my_team(). An empty person (no PIC, no support) is never in a team. */
export const inMyTeam = (
  team: readonly string[] | null,
  profileId: string | null,
) => team === null || (profileId !== null && team.includes(profileId));
