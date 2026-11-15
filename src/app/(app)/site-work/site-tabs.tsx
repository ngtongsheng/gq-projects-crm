import type { Translate } from "@/lib/i18n/translate";
import { SegmentLinks } from "./segment-links";
import { SITE_VIEW_LABEL, type SiteView } from "./site-view";

/** The Site Work tabs, with a count in brackets where something waits (demo: vSite). */
export function SiteTabs({
  views,
  active,
  counts,
  t,
}: {
  views: readonly SiteView[];
  active: SiteView;
  counts: Partial<Record<SiteView, number>>;
  t: Translate;
}) {
  return (
    <SegmentLinks
      label={t("Site Work")}
      active={active}
      items={views.map((view) => {
        const count = counts[view];
        return {
          key: view,
          label: `${t(SITE_VIEW_LABEL[view])}${count ? ` (${count})` : ""}`,
          href: `/site-work?view=${view}`,
        };
      })}
    />
  );
}
