import { z } from "zod";
import { type CalendarParams, calendarHref } from "../calendar/calendar-params";

export const INSTALLATION_PATH = "/installation";

/** The page's views: the calendar, and the installer directory (demo: S.iView "jobs" and "dir"). */
export const INSTALLATION_TABS = ["installers", "contacts"] as const;
export type InstallationTab = (typeof INSTALLATION_TABS)[number];

export const INSTALLATION_TAB_LABEL: Record<InstallationTab, string> = {
  installers: "Installers",
  contacts: "Installer contacts",
};

const tabParam = z.enum(INSTALLATION_TABS).catch("installers");
const installerParam = z.uuid().optional().catch(undefined);

export const parseInstallationTab = (value: unknown): InstallationTab =>
  tabParam.parse(value);

/** The installer to show jobs for; anything that is not an installer's id means everyone. */
export const parseInstallerFilter = (value: unknown): string | undefined =>
  installerParam.parse(value);

/** A calendar link that also keeps the installer filter (the supervisor filter is `who`). */
export function installationHref(
  params: Partial<CalendarParams> & { installer?: string },
): string {
  const { installer, ...calendar } = params;
  const base = calendarHref(calendar, INSTALLATION_PATH);
  if (!installer) return base;
  return `${base}${base.includes("?") ? "&" : "?"}installer=${installer}`;
}
