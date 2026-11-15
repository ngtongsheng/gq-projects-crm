import type { SampleRow } from "./samples-data";

export const ALL = "All";

/** The list under the search box and the two selects (demo vSamples). Order is kept. */
export function filterSamples(
  samples: readonly SampleRow[],
  filters: { query: string; product: string; brand: string },
): SampleRow[] {
  const query = filters.query.trim().toLowerCase();
  return samples.filter(
    (sample) =>
      (filters.product === ALL || sample.product === filters.product) &&
      (filters.brand === ALL || sample.brand === filters.brand) &&
      (query === "" ||
        [sample.sku, sample.name, sample.brand, sample.product, sample.notes]
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );
}
