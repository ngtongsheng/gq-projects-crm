/** The part of a costing revision that decides what "use as project value" would write. */
export type ValueRevision = {
  status: string;
  chosenOptionId: string | null;
  options: { id: string; sell: number }[];
};

/**
 * What an OK-to-quote costing says the project is worth: the option the customer chose, or the
 * highest option when none is chosen yet (the demo's `costLines`). Null when the costing is not
 * approved or sells nothing, so there is no value to offer.
 */
export function projectValueOf(revision: ValueRevision): number | null {
  if (revision.status !== "approved") return null;
  const chosen = revision.options.find(
    (option) => option.id === revision.chosenOptionId,
  );
  const amount =
    chosen?.sell ?? Math.max(0, ...revision.options.map((o) => o.sell));
  return amount > 0 ? amount : null;
}
