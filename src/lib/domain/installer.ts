import { normaliseMobile } from "./mobile";

/** What an installer can do, as the demo's "Skills" tick list (INST_SKILLS). */
export const INSTALLER_SKILLS = [
  "Carpet tile",
  "Broadloom carpet",
  "Vinyl tile / sheet",
  "SPC / laminate",
  "Timber",
  "Wallpaper",
  "Wall panel",
  "Sports flooring",
  "Edging / trims",
  "Epoxy / screeding",
  "Others",
] as const;
export type InstallerSkill = (typeof INSTALLER_SKILLS)[number];

/** The `wa.me` chat link for a Malaysian number as people write it; null when it is not one. */
export function whatsAppChatLink(phone: string): string | null {
  const mobile = normaliseMobile(phone);
  return mobile ? `https://wa.me/${mobile}` : null;
}

export type DirectoryInstaller = {
  name: string;
  company: string;
  phone: string;
  phone2: string;
  skills: readonly string[];
  description: string;
  area: string;
  notes: string;
  active: boolean;
};

/**
 * The directory's rows: inactive installers only when asked for, matched against the search
 * text in any of the fields people look up by, active first and then by name (demo: instDir).
 */
export function filterInstallers<T extends DirectoryInstaller>(
  installers: readonly T[],
  search: string,
  showInactive: boolean,
): T[] {
  const needle = search.trim().toLowerCase();
  return installers
    .filter((installer) => showInactive || installer.active)
    .filter(
      (installer) =>
        needle === "" ||
        [
          installer.name,
          installer.company,
          installer.phone,
          installer.phone2,
          installer.area,
          installer.notes,
          installer.description,
          ...installer.skills,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    )
    .toSorted(
      (a, b) =>
        Number(!a.active) - Number(!b.active) || a.name.localeCompare(b.name),
    );
}

export type InstallerJobDate = { installerId: string; scheduledOn: string };

/** How many jobs each installer has had and the start of their latest one (demo: instDir's `jobs` and `last`). */
export function tallyInstallerJobs(
  jobs: readonly InstallerJobDate[],
): Map<string, { jobCount: number; lastJobOn: string }> {
  const tally = new Map<string, { jobCount: number; lastJobOn: string }>();
  for (const job of jobs) {
    const before = tally.get(job.installerId);
    tally.set(job.installerId, {
      jobCount: (before?.jobCount ?? 0) + 1,
      lastJobOn:
        before && before.lastJobOn > job.scheduledOn
          ? before.lastJobOn
          : job.scheduledOn,
    });
  }
  return tally;
}
