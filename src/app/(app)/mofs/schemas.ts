import { z } from "zod";
import { MOF_STAGE_LABEL, MOF_STAGES } from "@/lib/domain/mof-stages";
import { lineAreaM2, orderTotal } from "@/lib/domain/mof-totals";
import { parseRm } from "@/lib/format/money";
import { AccountType } from "../customers/schemas";

// Values mirror the check constraints in the mofs migration.
export const MofStage = z.enum(MOF_STAGES);
export type MofStage = z.infer<typeof MofStage>;

export const MofStageLabel = MOF_STAGE_LABEL;

export const JobScope = z.enum(["s_and_l", "supply", "labour"]);
export type JobScope = z.infer<typeof JobScope>;

export const JobScopeLabel: Record<JobScope, string> = {
  s_and_l: "S&L",
  supply: "Supply",
  labour: "Labour",
};

export const StockType = z.enum(["stock", "indent", "custom"]);
export type StockType = z.infer<typeof StockType>;

export const StockTypeLabel: Record<StockType, string> = {
  stock: "Ex stock",
  indent: "Indent",
  custom: "Custom made",
};

export const LineUnit = z.enum(["m2", "sqft", "roll", "pcs"]);
export type LineUnit = z.infer<typeof LineUnit>;

export const LineUnitLabel: Record<LineUnit, string> = {
  m2: "m²",
  sqft: "sqft",
  roll: "roll",
  pcs: "pcs",
};

/** The four checks ticked before an order proceeds, keyed by their column names. */
export const PreProceedCheckLabel = {
  paymentChecked:
    "Payment status checked before delivery (no delivery without payment unless pre-approval signed by VL)",
  approvalsInWriting: "All approvals confirmed in writing",
  artworkSignedOff:
    "Artwork / shop drawing signed off by client before fabrication",
  dosPreApproved: "Every DO pre-approved by management before delivery",
} as const;

// A blank select posts "".
const optionalId = z.union([z.literal("").transform(() => null), z.uuid()]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

const optionalDate = (message: string) =>
  z.union([z.literal("").transform(() => null), z.iso.date(message)]);

// An unticked checkbox is left out of the form.
const tick = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

const rm = (message: string) =>
  z
    .string()
    .trim()
    .transform((text) => (text === "" ? 0 : parseRm(text)))
    .pipe(z.number(message));

const contractSum = rm("Enter the contract sum as an amount in RM.").pipe(
  z.number().positive("Enter the contract sum."),
);

const voAmount = rm(
  "Enter variation orders as an amount in RM, negative for an omission.",
);

const number = (message: string) =>
  z
    .string()
    .trim()
    .transform((text) => (text === "" ? 0 : Number(text.replace(/,/g, ""))))
    .pipe(z.number(message).min(0, "This can't be negative."))
    .transform((value) => Math.round(value * 100) / 100);

const TOTAL_MESSAGE = "The order total must be more than zero.";

export const mofLineSchema = z
  .object({
    product: z.string().trim().min(1, "Choose the product.").max(100),
    stockType: StockType,
    supplier: optionalText(100),
    qty: number("Enter the quantity as a number."),
    unit: LineUnit,
    areaM2: number("Enter the area in m² as a number."),
  })
  // Store the area in m2 for every line so totals and the supplier PO rule read one column.
  .transform((line) => ({ ...line, areaM2: lineAreaM2(line) }));
export type MofLine = z.infer<typeof mofLineSchema>;

export const mofFormSchema = z
  .object({
    mofNo: z
      .string()
      .trim()
      .min(1, "Enter the MOF number.")
      .max(50)
      .transform((value) => value.toUpperCase()),
    loaDate: z.iso.date("Choose the LOA / PO date."),
    salespersonId: z.uuid("Choose the salesperson."),
    secondSalespersonId: optionalId,
    projectId: optionalId,
    companyName: z.string().trim().min(1, "Enter the company.").max(200),
    projectName: z.string().trim().min(1, "Enter the project.").max(200),
    loaNo: optionalText(100),
    quoteNo: optionalText(100),
    siteAddress: optionalText(500),
    siteContactName: optionalText(200),
    siteContactMobile: optionalText(50),
    officePicId: optionalId,
    customerContact: optionalText(200),
    accountsContact: optionalText(200),
    scope: JobScope,
    installerName: optionalText(100),
    contractSum,
    voAmount,
    retentionPct: number("Enter the retention as a percentage.").pipe(
      z.number().max(100, "Retention can't be more than 100%."),
    ),
    invoiceNo: optionalText(100),
    invoiceDate: optionalDate("Choose a valid invoice date."),
    commissionType: AccountType,
    deliveryDate: optionalDate("Choose a valid delivery date."),
    stage: MofStage,
    latestUpdate: optionalText(300),
    paymentChecked: tick,
    approvalsInWriting: tick,
    artworkSignedOff: tick,
    dosPreApproved: tick,
    lines: z.array(mofLineSchema).min(1, "Add at least one product line."),
  })
  .refine(
    (form) =>
      form.secondSalespersonId === null ||
      form.secondSalespersonId !== form.salespersonId,
    {
      message: "The second salesperson must be a different person.",
      path: ["secondSalespersonId"],
    },
  )
  .refine((form) => orderTotal(form) > 0, {
    message: TOTAL_MESSAGE,
    path: ["voAmount"],
  });
export type MofForm = z.infer<typeof mofFormSchema>;

/** A change to the order total; the database refuses it without a reason. */
export const mofTotalChangeSchema = z
  .object({
    mofId: z.uuid({ error: "Could not find that MOF. Reload the page." }),
    contractSum,
    voAmount,
    reason: z
      .string()
      .trim()
      .min(
        1,
        "Give the reason for the change in order total, e.g. the credit note number.",
      )
      .max(300, "Keep the reason under 300 characters."),
  })
  .refine((change) => orderTotal(change) > 0, {
    message: TOTAL_MESSAGE,
    path: ["voAmount"],
  });
export type MofTotalChange = z.infer<typeof mofTotalChangeSchema>;

export const mofCostSchema = z.object({
  mofId: z.uuid({ error: "Could not find that MOF. Reload the page." }),
  cost: rm("Enter the cost as an amount in RM.").pipe(
    z.number().min(0, "The cost can't be negative."),
  ),
});
export type MofCost = z.infer<typeof mofCostSchema>;

export const mofIdSchema = z.uuid({
  error: "Could not find that MOF. Reload the page.",
});
