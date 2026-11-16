import type { Translate } from "@/lib/i18n/translate";
import { SegmentLinks } from "../site-work/segment-links";
import {
  INSTALLATION_PATH,
  INSTALLATION_TAB_LABEL,
  INSTALLATION_TABS,
  type InstallationTab,
} from "./installation-params";

/** The demo's segment control. The Site supervisors view joins it with the bookings page. */
export function InstallationTabs({
  t,
  active,
}: {
  t: Translate;
  active: InstallationTab;
}) {
  return (
    <SegmentLinks
      label={t("Installation views")}
      active={active}
      items={INSTALLATION_TABS.map((tab) => ({
        key: tab,
        label: t(INSTALLATION_TAB_LABEL[tab]),
        href:
          tab === "installers"
            ? INSTALLATION_PATH
            : `${INSTALLATION_PATH}?tab=${tab}`,
      }))}
    />
  );
}
