import { z } from "zod";
import { normaliseMobile } from "@/lib/domain/mobile";

// Values mirror the check constraints in the customers migration.
export const CompanyType = z.enum([
  "designer",
  "contractor",
  "main_contractor",
  "architect",
  "consultant",
  "developer",
  "dealer",
  "corporate",
  "others",
]);
export type CompanyType = z.infer<typeof CompanyType>;

export const CompanyTypeLabel: Record<CompanyType, string> = {
  designer: "Designer",
  contractor: "Contractor",
  main_contractor: "Main Contractor",
  architect: "Architect",
  consultant: "Consultant",
  developer: "Developer",
  dealer: "Dealer",
  corporate: "Corporate",
  others: "Others",
};

/** Decides the commission rate on the customer's projects. */
export const AccountType = z.enum(["own", "pass_down", "company"]);
export type AccountType = z.infer<typeof AccountType>;

export const AccountTypeLabel: Record<AccountType, string> = {
  own: "Own effort",
  pass_down: "Pass-down",
  company: "Company account",
};

export const RatingLabel: Record<number, string> = {
  1: "No related",
  2: "No service",
  3: "Occasional",
  4: "Potential",
  5: "VIP",
};

const rating = z.coerce
  .number<string>()
  .int()
  .min(1, "Choose a rating from 1 to 5.")
  .max(5, "Choose a rating from 1 to 5.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

// A blank select posts "".
const passedBy = z.union([z.literal("").transform(() => null), z.uuid()]);

const PASSED_BY_MESSAGE = "Choose who passed this customer down.";
const needsPassedBy = (form: {
  accountType: AccountType | null;
  passedBy: string | null;
}) => (form.accountType === "pass_down") === (form.passedBy !== null);

export const companyFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the company name.").max(200),
    companyType: CompanyType,
    rating,
    // Blank means not fixed: the salesperson chooses per project.
    accountType: z.union([z.literal("").transform(() => null), AccountType]),
    passedBy,
    address: optionalText(500),
    notes: optionalText(2000),
  })
  .refine(needsPassedBy, { message: PASSED_BY_MESSAGE, path: ["passedBy"] });

export const contactFormSchema = z
  .object({
    companyId: z.uuid("Choose the company."),
    name: z.string().trim().min(1, "Enter the contact's name.").max(200),
    mobile: z
      .string()
      .transform((value) => normaliseMobile(value))
      .pipe(
        z.string("Enter a full Malaysian mobile number, like 012-345 6789."),
      ),
    title: optionalText(100),
    rating,
    accountType: AccountType,
    passedBy,
    notes: optionalText(2000),
  })
  .refine(needsPassedBy, { message: PASSED_BY_MESSAGE, path: ["passedBy"] });
export type ContactForm = z.infer<typeof contactFormSchema>;
