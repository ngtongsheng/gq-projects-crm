import {
  Banknote,
  Boxes,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  HardHat,
  LayoutGrid,
  type LucideIcon,
  Moon,
  Percent,
  Target,
  Truck,
  Users,
} from "lucide-react";
import { isManager, type JobRole } from "./job-role";

export type SectionKey =
  | "dashboard"
  | "salesCalendar"
  | "installation"
  | "customers"
  | "projects"
  | "mof"
  | "siteWork"
  | "overtime"
  | "stock"
  | "collection"
  | "commission"
  | "reports"
  | "directorReport";

type Section = {
  key: SectionKey;
  label: string;
  /** Role-specific wording, e.g. "My Sales" for a salesperson's view of the MOF register. */
  labelFor?: (jobRole: JobRole) => string;
  href: string;
  /** Role-specific page, e.g. managers open Team Reports rather than their own report. */
  hrefFor?: (jobRole: JobRole) => string;
  icon: LucideIcon;
  allowed: readonly JobRole[];
  /** False until the task that builds the page flips it; unbuilt sections stay out of the sidebar. */
  built: boolean;
};

const SALES_SIDE: readonly JobRole[] = [
  "md",
  "director",
  "bd",
  "sales",
  "accounts",
];

// Order is the sidebar order. Mirrors the prototype's tabsDef.
const SECTIONS: readonly Section[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: LayoutGrid,
    allowed: [...SALES_SIDE, "support"],
    built: true,
  },
  {
    key: "salesCalendar",
    label: "Sales Calendar",
    href: "/calendar",
    icon: CalendarDays,
    allowed: SALES_SIDE,
    built: true,
  },
  {
    key: "installation",
    label: "Installation",
    labelFor: (jobRole) =>
      jobRole === "site"
        ? "Installation Calendar"
        : jobRole === "support"
          ? "Delivery & Installation"
          : "Installation",
    href: "/installation",
    icon: Truck,
    allowed: [...SALES_SIDE, "site", "support"],
    built: true,
  },
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    icon: Users,
    allowed: SALES_SIDE,
    built: true,
  },
  {
    key: "projects",
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    allowed: SALES_SIDE,
    built: true,
  },
  {
    key: "mof",
    label: "MOF Register",
    labelFor: (jobRole) =>
      isManager(jobRole) || jobRole === "support" ? "MOF Register" : "My Sales",
    href: "/mofs",
    icon: FileText,
    // The Sales Director sees the team's work elsewhere, so no MOF entry.
    allowed: ["md", "bd", "sales", "accounts", "support"],
    built: true,
  },
  {
    key: "siteWork",
    label: "Site Work",
    href: "/site-work",
    icon: HardHat,
    allowed: [...SALES_SIDE, "site", "support"],
    built: true,
  },
  {
    key: "overtime",
    label: "Overtime",
    href: "/overtime",
    icon: Moon,
    allowed: ["md", "director", "bd", "sales", "accounts", "site", "support"],
    built: true,
  },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Boxes,
    allowed: [...SALES_SIDE, "support"],
    built: true,
  },
  {
    key: "collection",
    label: "Collection",
    href: "/collection",
    icon: Banknote,
    allowed: SALES_SIDE,
    built: true,
  },
  {
    key: "commission",
    label: "Commission",
    href: "/commission",
    icon: Percent,
    allowed: SALES_SIDE,
    built: true,
  },
  {
    key: "reports",
    label: "My Report",
    labelFor: (jobRole) => (isManager(jobRole) ? "Team Reports" : "My Report"),
    href: "/reports",
    hrefFor: (jobRole) => (isManager(jobRole) ? "/reports/team" : "/reports"),
    icon: ClipboardList,
    // The BD Director's monthly report sits under Director Report, as in the prototype.
    allowed: ["md", "director", "sales", "accounts", "site"],
    built: true,
  },
  {
    key: "directorReport",
    label: "Director Report",
    href: "/reports/director",
    icon: Target,
    allowed: ["md", "director", "bd", "accounts"],
    built: true,
  },
];

export type NavSection = {
  key: SectionKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

const toNavSection = (section: Section, jobRole: JobRole): NavSection => ({
  key: section.key,
  label: section.labelFor?.(jobRole) ?? section.label,
  href: section.hrefFor?.(jobRole) ?? section.href,
  icon: section.icon,
});

/** Every section the role may open, built or not (the prototype's tab list). */
export const allowedSectionsFor = (jobRole: JobRole): NavSection[] =>
  SECTIONS.filter((s) => s.allowed.includes(jobRole)).map((s) =>
    toNavSection(s, jobRole),
  );

/** The sections to show in the sidebar: allowed for the role and with a page. */
export const sectionsFor = (jobRole: JobRole): NavSection[] =>
  SECTIONS.filter((s) => s.built && s.allowed.includes(jobRole)).map((s) =>
    toNavSection(s, jobRole),
  );

export const canOpenSection = (jobRole: JobRole, key: SectionKey): boolean =>
  SECTIONS.some((s) => s.key === key && s.allowed.includes(jobRole));
