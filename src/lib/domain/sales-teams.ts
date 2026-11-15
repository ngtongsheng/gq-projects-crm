import { canLeadTeam, type JobRole } from "@/lib/auth/job-role";

export type TeamPerson = {
  id: string;
  name: string;
  title: string | null;
  jobRole: JobRole;
  active: boolean;
  /** The team lead, set on the person (`reports_to`). */
  reportsTo: string | null;
  /** This year's effective sales target. */
  salesTarget: number | null;
};

export type SalesTeam = {
  leadId: string;
  leadName: string;
  leadTitle: string | null;
  members: { id: string; name: string }[];
  /** The lead's target plus the members', as in the Performance team column; null when nobody has one. */
  targetTotal: number | null;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

/** One team per Sales Director or Marketing Director still working here, with who reports to them. */
export function salesTeams(people: readonly TeamPerson[]): SalesTeam[] {
  return people
    .filter((person) => person.active && canLeadTeam(person.jobRole))
    .sort(byName)
    .map((lead) => {
      const members = people
        .filter((person) => person.active && person.reportsTo === lead.id)
        .sort(byName);
      const targets = [lead, ...members]
        .map((person) => person.salesTarget)
        .filter((target): target is number => target !== null);
      return {
        leadId: lead.id,
        leadName: lead.name,
        leadTitle: lead.title,
        members: members.map(({ id, name }) => ({ id, name })),
        targetTotal:
          targets.length === 0
            ? null
            : targets.reduce((sum, target) => sum + target, 0),
      };
    });
}
