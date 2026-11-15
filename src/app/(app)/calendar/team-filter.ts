import type { TeamMember } from "@/lib/auth/team-directory";

export type TeamFilter = {
  /** People the "Who" filter offers. */
  choices: TeamMember[];
  /** What the filter calls "nobody picked": "My team" for a team lead, "Everyone" for the MD. */
  allLabel: "My team" | "Everyone";
  /** The person to show, or undefined for the whole team. */
  who: string | undefined;
};

/**
 * The "Who" filter for a manager. `team` is the profile ids they see (public.my_team()), or
 * null for everyone. A person outside the team, e.g. from a hand-edited link, is ignored.
 */
export function teamFilter(input: {
  members: readonly TeamMember[];
  team: readonly string[] | null;
  picked: string | undefined;
}): TeamFilter {
  const { members, team, picked } = input;
  const choices =
    team === null ? [...members] : members.filter((m) => team.includes(m.id));
  return {
    choices,
    allLabel: team === null ? "Everyone" : "My team",
    who: choices.some((m) => m.id === picked) ? picked : undefined,
  };
}
