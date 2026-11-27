/**
 * The "A + B" label for the people on an MOF: the salesperson, then the second one if there is one.
 * The register and the summary leave a blank name out; Collection keeps its place.
 */
export function mofPeople(
  mof: { salespersonId: string; secondSalespersonId: string | null },
  nameOf: ReadonlyMap<string, string>,
  { keepBlankNames = false }: { keepBlankNames?: boolean } = {},
): string {
  return [mof.salespersonId, mof.secondSalespersonId]
    .flatMap((id) => (id ? [nameOf.get(id) ?? "Unnamed"] : []))
    .filter((name) => keepBlankNames || name !== "")
    .join(" + ");
}
