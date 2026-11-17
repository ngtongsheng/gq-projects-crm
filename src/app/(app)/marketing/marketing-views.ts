export const MARKETING_VIEWS = [
  "dashboard",
  "expenses",
  "vendors",
  "events",
  "prepaid",
  "giveaway",
] as const;
export type MarketingView = (typeof MARKETING_VIEWS)[number];

export const MARKETING_VIEW_LABEL: Record<MarketingView, string> = {
  dashboard: "Dashboard",
  expenses: "Expense log",
  vendors: "Vendors & part-timers",
  events: "Events",
  prepaid: "Prepaid accounts",
  giveaway: "Sample give-away",
};
