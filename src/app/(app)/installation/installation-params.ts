import { z } from "zod";
import { type CalendarParams, calendarHref } from "../calendar/calendar-params";

export const INSTALLATION_PATH = "/installation";

/** The page's views: the calendar, the site supervisors' bookings and the installer directory (demo: S.iView "jobs", "sup" and "dir"). */
export const INSTALLATION_TABS = [
  "installers",
  "supervisors",
  "contacts",
] as const;
export type InstallationTab = (typeof INSTALLATION_TABS)[number];

export const INSTALLATION_TAB_LABEL: Record<InstallationTab, string> = {
  installers: "Installers",
  supervisors: "Site supervisors",
  contacts: "Installer contacts",
};

const tabParam = z.enum(INSTALLATION_TABS).catch("installers");
const installerParam = z.uuid().optional().catch(undefined);

export const parseInstallationTab = (value: unknown): InstallationTab =>
  tabParam.parse(value);

/** The installer to show jobs for; anything that is not an installer's id means everyone. */
export const parseInstallerFilter = (value: unknown): string | undefined =>
  installerParam.parse(value);

/**
 * A calendar link that also keeps the installer filter (the supervisor filter is `who`) and
 * the tab; the calendar is the default tab and stays out of the link.
 */
export function installationHref(
  params: Partial<CalendarParams> & {
    installer?: string;
    tab?: InstallationTab;
  },
): string {
  const { installer, tab, ...calendar } = params;
  const extra = new URLSearchParams();
  if (installer) extra.set("installer", installer);
  if (tab && tab !== "installers") extra.set("tab", tab);
  const base = calendarHref(calendar, INSTALLATION_PATH);
  const text = extra.toString();
  if (!text) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${text}`;
}
