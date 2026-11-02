import { z } from "zod";
import type { TeamMember } from "@/lib/auth/team-directory";
import type { ImportField } from "./parse-tsv";

// "Main Contractor", "main_contractor" and "MAIN CONTRACTOR" are the same choice.
export const optionKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The option a pasted cell names, by its value or its label; undefined when it names none. */
export function matchOption<T extends string>(
  value: string,
  options: readonly T[],
  labels: Record<T, string>,
): T | undefined {
  const wanted = optionKey(value);
  return options.find(
    (option) =>
      optionKey(option) === wanted || optionKey(labels[option]) === wanted,
  );
}

/** The id of the one team member with this name; otherwise adds why not to `issues` and returns "". */
export function personId(
  name: string,
  team: readonly TeamMember[],
  issues: string[],
) {
  const wanted = name.trim().toLowerCase();
  const found = team.filter((member) => member.name.toLowerCase() === wanted);
  if (found.length === 1) return found[0].id;
  issues.push(
    found.length === 0
      ? `No one called "${name}" in the team.`
      : `More than one person is called "${name}".`,
  );
  return "";
}

const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

/**
 * Sheet dates are day first ("5/11/2026", "05/11/26"). Returns "YYYY-MM-DD"; any other text
 * comes back unchanged for the schema's date check to judge.
 */
export function sheetDate(text: string): string {
  const match = SLASH_DATE.exec(text.trim());
  if (!match) return text;
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** A schema that reads every field of a paste as the text of its cell. */
export const cellsOf = <Key extends string>(
  fields: readonly ImportField<Key>[],
): z.ZodObject<Record<Key, z.ZodString>> =>
  z.object(
    Object.fromEntries(fields.map((field) => [field.key, z.string()])),
  ) as z.ZodObject<Record<Key, z.ZodString>>;

/** Reports every issue in a transform and stops it. */
export const rejectIssues = (issues: string[], ctx: z.RefinementCtx) => {
  for (const message of issues) ctx.addIssue({ code: "custom", message });
  return z.NEVER;
};

/** Keeps only the entries whose key is marked true in `keep`. */
export function pickKept(
  all: Record<string, unknown>,
  keep: Record<string, boolean>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(all).filter(([key]) => keep[key]));
}
