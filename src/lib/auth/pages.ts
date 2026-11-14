import { z } from "zod";
import { isManager, type JobRole } from "./job-role";

/** Every page in the demo's access matrix (demo: PAGES), in the matrix's row order. */
export const PageKey = z.enum([
  "today",
  "hr",
  "tools",
  "claims",
  "tasks",
  "leave",
  "dash",
  "cal",
  "inst",
  "cust",
  "proj",
  "cost",
  "mof",
  "site",
  "stock",
  "coll",
  "comm",
  "perf",
  "rep",
  "srep",
  "drep",
]);
export type PageKey = z.infer<typeof PageKey>;

/** A matrix row: a page, or "See margin % and cost". */
export const AccessKey = z.union([PageKey, z.literal("margin")]);
export type AccessKey = z.infer<typeof AccessKey>;

/** A matrix column. "arrange" is a salesperson who also arranges stock (demo: roleKey). */
export const RoleKey = z.enum([
  "sales",
  "designer",
  "marketing",
  "ssup",
  "arrange",
  "site",
  "support",
  "accounts",
  "director",
  "bd",
  "md",
]);
export type RoleKey = z.infer<typeof RoleKey>;

/** The MD's changes from the defaults, per role and row. */
export type AccessOverrides = Partial<
  Record<RoleKey, Partial<Record<AccessKey, boolean>>>
>;

/** What decides a person's pages: their job role and the per-person ticks in People. */
export type Viewer = {
  jobRole: JobRole;
  arrangesStock: boolean;
  /** A Site Supervisor who also sells gets the selling pages. */
  sells: boolean;
  /** Sees margin and cost whatever their role's setting. */
  seesMargin: boolean;
};

type Page = {
  key: PageKey;
  /** The row name in People's matrix. */
  matrixLabel: string;
  /** The sidebar name, which differs by role as in the demo's tabsDefBase. */
  label: (viewer: Viewer) => string;
  href: (viewer: Viewer) => string;
  /** "after" pages sit below the sidebar divider. */
  group: "main" | "after";
  /** False until a later loop builds it; hidden everywhere until then. */
  built: boolean;
};

const fixed = (text: string) => () => text;
const isSite = (viewer: Viewer) => viewer.jobRole === "site";
const forSite = (siteLabel: string, label: string) => (viewer: Viewer) =>
  isSite(viewer) ? siteLabel : label;

const PAGES: Record<PageKey, Page> = {
  today: {
    key: "today",
    matrixLabel: "Log work (site supervisor)",
    label: fixed("Log work"),
    href: fixed("/today"),
    group: "main",
    built: false,
  },
  hr: {
    key: "hr",
    matrixLabel: "HR (policies & packages)",
    label: fixed("HR"),
    href: fixed("/hr"),
    group: "main",
    built: false,
  },
  tools: {
    key: "tools",
    matrixLabel: "Tools & Forms",
    label: fixed("Tools & Forms"),
    href: fixed("/tools"),
    group: "after",
    built: false,
  },
  claims: {
    key: "claims",
    matrixLabel: "Claims (commission & travel)",
    label: (viewer) => (isManager(viewer.jobRole) ? "Claims" : "My claims"),
    // Overtime is part of the monthly claim in the demo; it is the only claim built so far.
    href: fixed("/overtime"),
    group: "main",
    built: true,
  },
  tasks: {
    key: "tasks",
    matrixLabel: "Tasks",
    label: fixed("Tasks"),
    href: fixed("/tasks"),
    group: "after",
    built: false,
  },
  leave: {
    key: "leave",
    matrixLabel: "Leave",
    label: fixed("Leave"),
    href: fixed("/leave"),
    group: "after",
    built: false,
  },
  dash: {
    key: "dash",
    matrixLabel: "Dashboard",
    label: fixed("Dashboard"),
    href: fixed("/"),
    group: "main",
    built: true,
  },
  cal: {
    key: "cal",
    matrixLabel: "Sales Calendar",
    label: fixed("Sales Calendar"),
    href: fixed("/calendar"),
    group: "main",
    built: true,
  },
  inst: {
    key: "inst",
    matrixLabel: "Installation",
    label: (viewer) =>
      isSite(viewer)
        ? "My schedule"
        : viewer.jobRole === "support" || viewer.jobRole === "ssup"
          ? "Delivery & Installation"
          : "Installation",
    href: fixed("/installation"),
    group: "main",
    built: true,
  },
  cust: {
    key: "cust",
    matrixLabel: "Customers",
    label: forSite("My customers", "Customers"),
    href: fixed("/customers"),
    group: "main",
    built: true,
  },
  proj: {
    key: "proj",
    matrixLabel: "Projects",
    label: forSite("My sales", "Projects"),
    href: fixed("/projects"),
    group: "main",
    built: true,
  },
  cost: {
    key: "cost",
    matrixLabel: "Costing",
    label: fixed("Costing"),
    href: fixed("/costing"),
    group: "main",
    built: true,
  },
  mof: {
    key: "mof",
    matrixLabel: "MOF Register / My Sales",
    label: (viewer) =>
      isManager(viewer.jobRole) || viewer.jobRole === "support"
        ? "MOF Register"
        : "My Sales",
    href: fixed("/mofs"),
    group: "main",
    built: true,
  },
  site: {
    key: "site",
    matrixLabel: "Site Work",
    label: (viewer) =>
      viewer.jobRole === "marketing" ? "Site photos" : "Site Work",
    href: fixed("/site-work"),
    group: "main",
    built: true,
  },
  stock: {
    key: "stock",
    matrixLabel: "Stock",
    label: fixed("Stock"),
    href: fixed("/stock"),
    group: "main",
    built: true,
  },
  coll: {
    key: "coll",
    matrixLabel: "Collection",
    label: forSite("My collection", "Collection"),
    href: fixed("/collection"),
    group: "main",
    built: true,
  },
  comm: {
    key: "comm",
    matrixLabel: "Commission",
    label: forSite("My commission", "Commission"),
    href: fixed("/commission"),
    group: "main",
    built: true,
  },
  perf: {
    key: "perf",
    matrixLabel: "Sales Performance",
    label: fixed("Sales Performance"),
    href: fixed("/performance"),
    group: "after",
    // /performance is the admins' version; the per-role page is a later loop's.
    built: false,
  },
  rep: {
    key: "rep",
    matrixLabel: "Monthly report",
    label: (viewer) =>
      isManager(viewer.jobRole) ? "Team Reports" : "My Report",
    href: (viewer) =>
      isManager(viewer.jobRole) ? "/reports/team" : "/reports",
    group: "main",
    built: true,
  },
  srep: {
    key: "srep",
    matrixLabel: "Site supervisor report",
    label: forSite("My Report", "Site Report"),
    href: fixed("/reports"),
    group: "main",
    built: true,
  },
  drep: {
    key: "drep",
    matrixLabel: "Director Report",
    label: fixed("Director Report"),
    href: fixed("/reports/director"),
    group: "main",
    built: true,
  },
};

const SALES_PAGES: readonly PageKey[] = [
  "dash",
  "cal",
  "inst",
  "cust",
  "proj",
  "cost",
  "mof",
  "site",
  "stock",
  "coll",
  "comm",
  "claims",
  "perf",
  "tasks",
  "leave",
];

/**
 * Each role's default pages in sidebar order, copied from the demo's tabsDefBase (People is
 * the MD's own page and sits outside the matrix).
 */
const ROLE_PAGES: Record<RoleKey, readonly PageKey[]> = {
  md: [...SALES_PAGES, "rep", "drep", "hr"],
  director: [...SALES_PAGES.filter((key) => key !== "mof"), "rep", "drep"],
  bd: [...SALES_PAGES, "drep"],
  sales: [...SALES_PAGES, "rep"],
  arrange: [...SALES_PAGES, "rep"],
  accounts: [...SALES_PAGES, "rep", "drep", "hr"],
  site: ["today", "inst", "site", "srep", "claims", "tasks", "leave"],
  ssup: ["dash", "inst", "site", "stock", "tasks", "leave"],
  designer: ["dash", "tasks", "leave"],
  marketing: ["dash", "tasks", "site", "stock", "leave"],
  support: ["dash", "cost", "mof", "inst", "site", "stock", "tasks", "leave"],
};

/** A Site Supervisor who sells gets these after their report. */
const SITE_SELLING_PAGES: readonly PageKey[] = ["cust", "proj", "coll", "comm"];

/** The demo's ACCESS0: defaults that differ from the role's page list. */
const DEFAULT_OVERRIDES: AccessOverrides = {
  sales: { mof: false },
  arrange: { mof: false },
  director: { mof: false },
  site: { cost: false },
};

const MARGIN_ROLES: readonly RoleKey[] = ["md", "accounts", "support"];

export const roleKeyOf = (viewer: Pick<Viewer, "jobRole" | "arrangesStock">) =>
  viewer.jobRole === "sales" && viewer.arrangesStock
    ? "arrange"
    : viewer.jobRole;

function rolePages(roleKey: RoleKey, sells: boolean): readonly PageKey[] {
  const pages = ROLE_PAGES[roleKey];
  if (roleKey !== "site" || !sells) return pages;
  const at = pages.indexOf("srep") + 1;
  return [...pages.slice(0, at), ...SITE_SELLING_PAGES, ...pages.slice(at)];
}

/** The matrix's default for a cell (demo: accDefault). */
export function defaultAllowed(
  roleKey: RoleKey,
  key: AccessKey,
  sells = false,
): boolean {
  const preset = DEFAULT_OVERRIDES[roleKey]?.[key];
  if (preset !== undefined) return preset;
  if (key === "margin") return MARGIN_ROLES.includes(roleKey);
  return key === "tools" || rolePages(roleKey, sells).includes(key);
}

/** A cell as it stands: the MD always; otherwise the MD's override, else the default (demo: accAllowed). */
export function accessAllowed(
  roleKey: RoleKey,
  key: AccessKey,
  overrides: AccessOverrides,
  sells = false,
): boolean {
  if (roleKey === "md") return true;
  return overrides[roleKey]?.[key] ?? defaultAllowed(roleKey, key, sells);
}

/** Opens the page: it is built and the person's role is allowed it. */
export const canOpenPage = (
  viewer: Viewer,
  key: PageKey,
  overrides: AccessOverrides,
) =>
  PAGES[key].built &&
  accessAllowed(roleKeyOf(viewer), key, overrides, viewer.sells);

/** Sees margin % and cost (SQL: public.can_see_mof_cost()). */
export const canSeeMargin = (viewer: Viewer, overrides: AccessOverrides) =>
  viewer.seesMargin ||
  accessAllowed(roleKeyOf(viewer), "margin", overrides, viewer.sells);

export type NavPage = {
  key: PageKey;
  label: string;
  href: string;
  group: Page["group"];
};

/**
 * The person's sidebar pages in order (demo: tabsDef): their role's pages, then pages the MD
 * added in matrix order, with Tools & Forms just before Leave.
 */
export function navPagesFor(
  viewer: Viewer,
  overrides: AccessOverrides,
): NavPage[] {
  const roleKey = roleKeyOf(viewer);
  const base = rolePages(roleKey, viewer.sells);
  // The MD may open any page but keeps their own sidebar.
  const added =
    roleKey === "md"
      ? []
      : PageKey.options.filter((key) => key !== "tools" && !base.includes(key));
  const ordered = [...base, ...added];
  const leaveAt = ordered.indexOf("leave");
  ordered.splice(leaveAt < 0 ? ordered.length : leaveAt, 0, "tools");
  return ordered
    .filter((key) => canOpenPage(viewer, key, overrides))
    .map((key) => {
      const page = PAGES[key];
      return {
        key,
        label: page.label(viewer),
        href: page.href(viewer),
        group: page.group,
      };
    });
}

/** The Guide sits below every page for everyone, outside the matrix, as in the demo. */
export const GUIDE_PAGE = {
  label: "Guide",
  href: "/guide",
} as const;

/** The matrix rows in People: every page, then the margin row. */
export const MATRIX_ROWS: readonly { key: AccessKey; label: string }[] = [
  ...PageKey.options.map((key) => ({ key, label: PAGES[key].matrixLabel })),
  { key: "margin", label: "See margin % and cost" },
];

export const isBuilt = (key: PageKey) => PAGES[key].built;

/** The page's name for this person, e.g. "My schedule" for a Site Supervisor's Installation. */
export const pageLabel = (key: PageKey, viewer: Viewer) =>
  PAGES[key].label(viewer);
