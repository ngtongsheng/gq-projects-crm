/** What the Site Work search looks at for one project. */
export type SearchableSite = {
  mofNo: string;
  projectName: string;
  companyName: string;
  siteAddress: string;
};

/**
 * Projects matching what was typed. Every word has to appear somewhere in the MOF number, project,
 * company or site address, in any order and whatever the capitals; nothing typed shows all.
 */
export function searchSites<Site extends SearchableSite>(
  sites: readonly Site[],
  query: string,
): Site[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...sites];
  return sites.filter((site) => {
    const text =
      `${site.mofNo} ${site.projectName} ${site.companyName} ${site.siteAddress}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Splits projects into those the person is working on today and the rest, each in its order. */
export function splitToday<Site extends { id: string }>(
  sites: readonly Site[],
  todayIds: ReadonlySet<string>,
): { today: Site[]; others: Site[] } {
  return {
    today: sites.filter((site) => todayIds.has(site.id)),
    others: sites.filter((site) => !todayIds.has(site.id)),
  };
}
