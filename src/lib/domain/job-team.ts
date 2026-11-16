import { z } from "zod";

export type Person = { id: string; name: string };

/** Who the job form can pick from; loaded once and handed to every job form on the page. */
export type JobPeople = {
  installers: Person[];
  supervisors: Person[];
  salespeople: Person[];
};

/** The job form's team choice for a job with no installer crew, only the supervisor (demo: TEAMS). */
export const SUPERVISOR_ONLY = "supervisor_only";

export type JobTeam = { installerId: string | null; supervisorOnly: boolean };

/** What the team choice posted by the job form means; null when it is neither blank, a supervisor-only job nor an installer id. */
export function parseTeamChoice(value: string): JobTeam | null {
  if (value === "") return { installerId: null, supervisorOnly: false };
  if (value === SUPERVISOR_ONLY) {
    return { installerId: null, supervisorOnly: true };
  }
  return z.uuid().safeParse(value).success
    ? { installerId: value, supervisorOnly: false }
    : null;
}

const nameKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/** The installer whose name matches the one typed on the MOF, so a new job starts with them picked. */
export function installerIdByName(
  installers: readonly Person[],
  name: string,
): string | undefined {
  if (nameKey(name) === "") return undefined;
  return installers.find(
    (installer) => nameKey(installer.name) === nameKey(name),
  )?.id;
}

/** The installers a form offers; `current` stays pickable after they are made inactive. */
export function installerChoices(
  installers: readonly Person[],
  current: Person | null,
): Person[] {
  return current && !installers.some((installer) => installer.id === current.id)
    ? [...installers, current]
    : [...installers];
}

export type InChargeGroups = {
  supervisors: Person[];
  salespeople: Person[];
  /** The person already on the job when they are in neither list, e.g. someone who has since left. */
  others: Person[];
};

/**
 * The "person in charge" choices as the demo groups them: Site supervisors, then Salesperson
 * in charge. `current` stays pickable even when they are no longer in either list.
 */
export function inChargeGroups(
  people: Pick<JobPeople, "supervisors" | "salespeople">,
  current: Person | null,
): InChargeGroups {
  const listed = [...people.supervisors, ...people.salespeople];
  return {
    supervisors: people.supervisors,
    salespeople: people.salespeople,
    others:
      current && !listed.some((person) => person.id === current.id)
        ? [current]
        : [],
  };
}
