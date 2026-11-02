/** Overdue follow-ups across sites, for the Needs attention list. */
export const overdueFollowUpTotal = (
  sites: readonly { overdueFollowUps: number }[],
) => sites.reduce((total, site) => total + site.overdueFollowUps, 0);
