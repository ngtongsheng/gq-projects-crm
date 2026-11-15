import { countSamples } from "../samples/samples-data";
import { SegmentLinks } from "../site-work/segment-links";
import { countLeftoverAvailable } from "./leftover/leftover-count";

export type StockTab = "reservations" | "items" | "leftover" | "samples";

/** The demo's segments across the Stock pages. Samples is its own page, /samples. */
export async function StockTabs({ active }: { active: StockTab }) {
  const [leftover, samples] = await Promise.all([
    countLeftoverAvailable(),
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
