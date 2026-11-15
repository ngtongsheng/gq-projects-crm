import { SegmentLinks } from "../site-work/segment-links";
import { countLeftoverAtBestLink } from "./leftover/leftover-count";

export type StockTab = "reservations" | "items" | "leftover" | "samples";

/**
 * The demo's segments across the Stock pages. Samples links to its own page (loop 18 task 08);
 * its count joins the label once the samples table exists.
 */
export async function StockTabs({ active }: { active: StockTab }) {
  const leftover = await countLeftoverAtBestLink();
  return (
    <SegmentLinks
      label="Stock"
      active={active}
      items={[
        { key: "reservations", label: "Reserved for clients", href: "/stock" },
        { key: "items", label: "Stock items", href: "/stock?view=items" },
        {
          key: "leftover",
          label: `Leftover stock at Best Link (${leftover})`,
          href: "/stock/leftover",
        },
        { key: "samples", label: "Samples at Best Link", href: "/samples" },
      ]}
    />
  );
}
