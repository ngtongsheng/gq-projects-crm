/** Narrows a value, e.g. from a select, to one of the listed options. */
export const isOneOf = <T extends string>(
  options: readonly T[],
  value: string,
): value is T => options.some((option) => option === value);
