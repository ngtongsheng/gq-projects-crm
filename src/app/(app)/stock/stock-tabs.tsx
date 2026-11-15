import { countSamples } from "../samples/samples-data";
import { SegmentLinks } from "../site-work/segment-links";
import { countLeftoverAtBestLink } from "./leftover/leftover-count";

export type StockTab = "reservations" | "items" | "leftover" | "samples";

/** The demo's segments across the Stock pages. Samples is its own page, /samples. */
export async function StockTabs({ active }: { active: StockTab }) {
  const [leftover, samples] = await Promise.all([
    countLeftoverAtBestLink(),
    countSamples(),
  ]);
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
        {
          key: "samples",
          label: `Samples at Best Link (${samples})`,
          href: "/samples",
        },
      ]}
    />
  );
}
