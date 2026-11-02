import { z } from "zod";
import type { TeamMember } from "@/lib/auth/team-directory";
import {
  buildImportPlan,
  type DuplicateChoice,
  type ImportPlan,
} from "@/lib/import/import-plan";
import { type ImportField, mapPaste } from "@/lib/import/parse-tsv";
import {
  AccountType,
  AccountTypeLabel,
  CompanyType,
  CompanyTypeLabel,
  companyFormSchema,
  contactFormSchema,
  RatingLabel,
} from "./schemas";

export const CustomerImportKind = z.enum(["companies", "contacts"]);
export type CustomerImportKind = z.infer<typeof CustomerImportKind>;

export const companyImportFields = [
  {
    key: "name",
    label: "Company",
    aliases: ["Company name", "Name"],
    required: true,
  },
  { key: "companyType", label: "Type", aliases: ["Company type", "Category"] },
  { key: "rating", label: "Rating" },
  { key: "accountType", label: "Account type", aliases: ["Account"] },
  { key: "passedBy", label: "Passed by", aliases: ["Passed down by"] },
  { key: "address", label: "Address" },
  { key: "notes", label: "Notes", aliases: ["Remarks", "Remark"] },
] as const satisfies readonly ImportField<string>[];
type CompanyKey = (typeof companyImportFields)[number]["key"];

export const contactImportFields = [
  {
    key: "company",
    label: "Company",
    aliases: ["Company name"],
    required: true,
  },
  {
    key: "name",
    label: "Name",
    aliases: ["Customer", "Contact", "Contact name", "Customer name"],
    required: true,
  },
  {
    key: "mobile",
    label: "Mobile",
    aliases: ["Mobile no", "Phone", "Phone no", "HP", "HP no", "Contact no"],
    required: true,
  },
  { key: "title", label: "Position", aliases: ["Title", "Designation"] },
  { key: "rating", label: "Rating" },
  { key: "accountType", label: "Account type", aliases: ["Account"] },
  { key: "passedBy", label: "Passed by", aliases: ["Passed down by"] },
  { key: "owners", label: "Owners", aliases: ["Owner", "PIC", "Salesperson"] },
  { key: "notes", label: "Notes", aliases: ["Remarks", "Remark"] },
] as const satisfies readonly ImportField<string>[];
type ContactKey = (typeof contactImportFields)[number]["key"];

const cellsOf = <Key extends string>(
  fields: readonly ImportField<Key>[],
): z.ZodObject<Record<Key, z.ZodString>> =>
  z.object(
    Object.fromEntries(fields.map((field) => [field.key, z.string()])),
  ) as z.ZodObject<Record<Key, z.ZodString>>;

// "Main Contractor", "main_contractor" and "MAIN CONTRACTOR" are the same choice.
const optionKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

function matchOption<T extends string>(
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

/** "4", "4 · Potential" or "Potential"; blank means the usual 3. */
function matchRating(value: string): string | undefined {
  if (value === "") return "3";
  const digit = /^([1-5])(\D|$)/.exec(value)?.[1];
  if (digit) return digit;
  const wanted = optionKey(value);
  return Object.entries(RatingLabel).find(
    ([, label]) => optionKey(label) === wanted,
  )?.[0];
}

type Issues = string[];

function personId(name: string, team: readonly TeamMember[], issues: Issues) {
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

function readShared(
  cells: { rating: string; accountType: string; passedBy: string },
  team: readonly TeamMember[],
  issues: Issues,
) {
  const rating = matchRating(cells.rating);
  if (!rating) issues.push("Rating must be 1 to 5, or a label like VIP.");
  const accountType =
    cells.accountType === ""
      ? ""
      : matchOption(cells.accountType, AccountType.options, AccountTypeLabel);
  if (accountType === undefined) {
    issues.push("Account type must be Own effort, Pass-down or Company.");
  }
  const passedBy =
    cells.passedBy === "" ? "" : personId(cells.passedBy, team, issues);
  return { rating: rating ?? "", accountType: accountType ?? "", passedBy };
}

const reject = (issues: Issues, ctx: z.RefinementCtx) => {
  for (const message of issues) ctx.addIssue({ code: "custom", message });
  return z.NEVER;
};

export function companyImportSchema(team: readonly TeamMember[]) {
  return cellsOf<CompanyKey>(companyImportFields)
    .transform((cells, ctx) => {
      const issues: Issues = [];
      const companyType =
        cells.companyType === ""
          ? "others"
          : matchOption(
              cells.companyType,
              CompanyType.options,
              CompanyTypeLabel,
            );
      if (!companyType) issues.push(`"${cells.companyType}" is not a type.`);
      const shared = readShared(cells, team, issues);
      if (issues.length > 0) return reject(issues, ctx);
      return {
        name: cells.name,
        companyType: companyType ?? "others",
        ...shared,
        address: cells.address,
        notes: cells.notes,
      };
    })
    .pipe(companyFormSchema);
}

const OWNER_SEPARATOR = /\s*(?:[,/+&]|\band\b)\s*/i;

export function contactImportSchema(
  team: readonly TeamMember[],
  /** Lower-case company name to id. */
  companies: ReadonlyMap<string, string>,
) {
  return cellsOf<ContactKey>(contactImportFields)
    .transform((cells, ctx) => {
      const issues: Issues = [];
      const companyId = companies.get(cells.company.toLowerCase());
      if (cells.company === "") issues.push("Enter the company.");
      else if (!companyId) {
        issues.push(`No company called "${cells.company}". Paste it first.`);
      }
      const shared = readShared(cells, team, issues);
      const ownerNames = cells.owners
        .split(OWNER_SEPARATOR)
        .filter((name) => name !== "");
      if (ownerNames.length > 2) {
        issues.push("A customer can have at most two owners.");
      }
      const owners = ownerNames.map((name) => personId(name, team, issues));
      if (issues.length > 0) return reject(issues, ctx);
      return {
        contact: {
          companyId: companyId ?? "",
          name: cells.name,
          mobile: cells.mobile,
          title: cells.title,
          ...shared,
          accountType: shared.accountType || "own",
          notes: cells.notes,
        },
        owners,
      };
    })
    .pipe(
      z.object({
        contact: contactFormSchema,
        owners: z.array(z.uuid()).max(2),
      }),
    );
}

export type CompanyImportRow = z.infer<ReturnType<typeof companyImportSchema>>;
export type ContactImportRow = z.infer<ReturnType<typeof contactImportSchema>>;

/** Everything already in the CRM that a paste is checked against. */
export type CustomerImportContext = {
  team: readonly TeamMember[];
  /** Lower-case company name to id. */
  companies: ReadonlyMap<string, string>;
  /** Stored mobile to contact id, archived contacts included. */
  mobiles: ReadonlyMap<string, string>;
};

export type CustomerImportPlan =
  | {
      kind: "companies";
      plan: ImportPlan<CompanyKey, CompanyImportRow>;
    }
  | {
      kind: "contacts";
      plan: ImportPlan<ContactKey, ContactImportRow>;
    };

export function planCustomerImport(
  kind: CustomerImportKind,
  text: string,
  onDuplicate: DuplicateChoice,
  context: CustomerImportContext,
): CustomerImportPlan {
  if (kind === "companies") {
    return {
      kind,
      plan: buildImportPlan({
        paste: mapPaste(text, companyImportFields),
        schema: companyImportSchema(context.team),
        keyOf: (row) => row.name.toLowerCase(),
        existing: context.companies,
        onDuplicate,
      }),
    };
  }
  return {
    kind,
    plan: buildImportPlan({
      paste: mapPaste(text, contactImportFields),
      schema: contactImportSchema(context.team, context.companies),
      keyOf: (row) => row.contact.mobile,
      existing: context.mobiles,
      onDuplicate,
    }),
  };
}

type Payload = Record<string, unknown>;

/**
 * Rows for the import_companies / import_contacts database functions: only rows
 * to add or update. An update carries the record id and only the pasted
 * columns, so a column left out of the paste keeps its saved value.
 */
export function importPayload({ kind, plan }: CustomerImportPlan): Payload[] {
  const pasted = new Set<string>(plan.columns);
  const has = (...keys: string[]) => keys.some((key) => pasted.has(key));
  const payload: Payload[] = [];

  if (kind === "companies") {
    for (const { action, row, existingId } of plan.rows) {
      if (!row || (action !== "add" && action !== "update")) continue;
      const all: Payload = {
        name: row.name,
        company_type: row.companyType,
        rating: row.rating,
        address: row.address,
        notes: row.notes,
      };
      // Account type and passed-by are checked together by the database.
      const account = {
        account_type: row.accountType,
        passed_by: row.passedBy,
      };
      payload.push(
        action === "add"
          ? { ...all, ...account }
          : {
              id: existingId,
              ...pick(all, {
                name: true,
                company_type: has("companyType"),
                rating: has("rating"),
                address: has("address"),
                notes: has("notes"),
              }),
              ...(has("accountType", "passedBy") ? account : {}),
            },
      );
    }
    return payload;
  }

  for (const { action, row, existingId } of plan.rows) {
    if (!row || (action !== "add" && action !== "update")) continue;
    const { contact, owners } = row;
    const all: Payload = {
      company_id: contact.companyId,
      name: contact.name,
      mobile: contact.mobile,
      title: contact.title,
      rating: contact.rating,
      notes: contact.notes,
    };
    const account = {
      account_type: contact.accountType,
      passed_by: contact.passedBy,
    };
    // No owners pasted: whoever imports owns new rows; updated rows keep theirs.
    const ownersPart = owners.length > 0 ? { owners } : {};
    payload.push(
      action === "add"
        ? { ...all, ...account, ...ownersPart }
        : {
            id: existingId,
            ...pick(all, {
              company_id: true,
              name: true,
              mobile: true,
              title: has("title"),
              rating: has("rating"),
              notes: has("notes"),
            }),
            ...(has("accountType", "passedBy") ? account : {}),
            ...ownersPart,
          },
    );
  }
  return payload;
}

function pick(all: Payload, keep: Record<string, boolean>): Payload {
  return Object.fromEntries(Object.entries(all).filter(([key]) => keep[key]));
}
