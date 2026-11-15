/** The segment control on HR; each view is its own address so it survives a reload. */
export const HR_VIEWS = ["policies", "staff", "grades"] as const;
export type HrView = (typeof HR_VIEWS)[number];

export const HR_VIEW_LABEL: Record<HrView, string> = {
  policies: "Policies & schemes",
  staff: "Staff packages",
  grades: "Sales grades & bonus",
};

export function parseHrView(value: string | string[] | undefined): HrView {
  return HR_VIEWS.find((view) => view === value) ?? "policies";
}
