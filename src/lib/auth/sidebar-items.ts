import {
  type AccessOverrides,
  GUIDE_PAGE,
  type NavPage,
  navPagesFor,
  type PageKey,
  type Viewer,
} from "./pages";

/** A sidebar entry and its icon: every page, plus People and the Guide, which sit outside the access matrix. */
export type SidebarKey = PageKey | "people" | "guide";

export type SidebarItem = {
  key: SidebarKey;
  label: string;
  href: string;
  /** A count at the right edge; hidden at zero. */
  badge?: number;
};

/** Pages above the divider, then the Guide and the pages below it (demo: the `after` list). */
export type SidebarItems = { main: SidebarItem[]; after: SidebarItem[] };

type SidebarInput = {
  viewer: Viewer;
  /** Admins keep the Sales Performance and People links until those pages join the registry. */
  isAdmin: boolean;
  overrides: AccessOverrides;
  /** The count each page's badge shows, e.g. open ownership requests on the Dashboard. */
  badges?: Partial<Record<PageKey, number>>;
};

export function sidebarItemsFor({
  viewer,
  isAdmin,
  overrides,
  badges = {},
}: SidebarInput): SidebarItems {
  const pages = navPagesFor(viewer, overrides);
  const item = ({ key, label, href }: NavPage): SidebarItem => ({
    key,
    label,
    href,
    badge: badges[key],
  });
  const main = pages.filter((page) => page.group === "main").map(item);
  const after = pages.filter((page) => page.group === "after").map(item);

  if (isAdmin) {
    // Demo order below the divider: Guide, Sales Performance, People, Tasks, Tools & Forms, Leave.
    const adminLinks: SidebarItem[] = [
      { key: "people", label: "People", href: "/people" },
    ];
    if (!after.some((page) => page.key === "perf")) {
      adminLinks.unshift({
        key: "perf",
        label: "Sales Performance",
        href: "/performance",
      });
    }
    const at = after.findIndex((page) => page.key !== "perf");
    after.splice(at < 0 ? after.length : at, 0, ...adminLinks);
  }

  return { main, after: [{ key: "guide", ...GUIDE_PAGE }, ...after] };
}
