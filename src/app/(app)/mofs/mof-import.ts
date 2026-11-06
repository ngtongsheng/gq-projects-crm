import { z } from "zod";
import type { TeamMember } from "@/lib/auth/team-directory";
import {
  buildImportPlan,
  type DuplicateChoice,
  type ImportPlan,
  toImportPreview,
} from "@/lib/import/import-plan";
import {
  cellsOf,
  matchOption,
  personId,
  pickKept,
  rejectIssues,
  sheetDate,
} from "@/lib/import/match-cells";
import {
  type ImportField,
  type MappedPaste,
  mapPaste,
  type PastedRecord,
} from "@/lib/import/parse-tsv";
import { AccountType, AccountTypeLabel } from "../customers/schemas";
import {
  JobScope,
  JobScopeLabel,
  LineUnit,
  LineUnitLabel,
  MofStage,
  MofStageLabel,
  mofCostSchema,
  mofFormSchema,
  StockType,
  StockTypeLabel,
} from "./schemas";

const allFields = [
  {
    key: "mofNo",
    label: "MOF no",
    aliases: ["MOF", "MOF number"],
    required: true,
  },
  {
    key: "loaDate",
    label: "LOA date",
    aliases: ["LOA / PO date", "PO date", "Date"],
    required: true,
  },
  {
    key: "salesperson",
    label: "Salesperson",
    aliases: ["Salesperson 1", "PIC", "Sales"],
    required: true,
  },
  {
    key: "company",
    label: "Company",
    aliases: ["Company name", "Client"],
    required: true,
  },
  {
    key: "project",
    label: "Project",
    aliases: ["Project name"],
    required: true,
  },
  {
    key: "contractSum",
    label: "Contract sum",
    aliases: ["Contract", "Contract value"],
    required: true,
  },
  {
    key: "secondSalesperson",
    label: "Second salesperson",
    aliases: ["Salesperson 2", "Support"],
  },
  { key: "voAmount", label: "VO", aliases: ["VO amount", "Variation order"] },
  { key: "scope", label: "Scope" },
  { key: "stage", label: "Stage", aliases: ["Status", "Register stage"] },
  { key: "deliveryDate", label: "Delivery date", aliases: ["Delivery"] },
  { key: "retention", label: "Retention %", aliases: ["Retention"] },
  { key: "invoiceNo", label: "Invoice no" },
  { key: "invoiceDate", label: "Invoice date" },
  {
    key: "commissionType",
    label: "Commission type",
    aliases: ["Account type"],
  },
  { key: "installer", label: "Installer" },
  { key: "loaNo", label: "LOA no" },
  { key: "quoteNo", label: "Quote no" },
  { key: "siteAddress", label: "Site address", aliases: ["Site"] },
  { key: "customerContact", label: "Customer contact" },
  { key: "accountsContact", label: "Accounts contact" },
  {
    key: "latestUpdate",
    label: "Latest update",
    aliases: ["Update", "Remarks", "Remark"],
  },
  { key: "cost", label: "Cost" },
  { key: "product", label: "Product" },
  { key: "stockType", label: "Stock type", aliases: ["Stock"] },
  { key: "supplier", label: "Supplier" },
  { key: "qty", label: "Qty", aliases: ["Quantity"] },
  { key: "unit", label: "Unit" },
  {
    key: "areaM2",
    label: "Area m2",
    aliases: ["Area (m²)", "Area", "Unijoy m2"],
  },
] as const satisfies readonly ImportField<string>[];
export type MofKey = (typeof allFields)[number]["key"];

/** The product line columns; a MOF with several products is pasted as several rows. */
const LINE_KEYS = [
  "product",
  "stockType",
  "supplier",
  "qty",
  "unit",
  "areaM2",
] as const satisfies readonly MofKey[];

/** Cost is for managers only, so for everyone else a "Cost" column is simply not imported. */
export function mofImportFields(seesCost: boolean): ImportField<MofKey>[] {
  return allFields.filter((field) => seesCost || field.key !== "cost");
}

// Joins the cells of one MOF's rows; cannot be typed in a sheet.
const JOIN = "\u001f";

/** Rows sharing a MOF no become one MOF: header cells must agree, line cells are kept in row order. */
function groupByMof(paste: MappedPaste<MofKey>): MappedPaste<MofKey> {
  const groups = new Map<string, PastedRecord<MofKey>[]>();
  const ordered: PastedRecord<MofKey>[][] = [];
  for (const record of paste.records) {
    const mofNo = record.cells.mofNo.toUpperCase();
    const group = mofNo === "" ? undefined : groups.get(mofNo);
    if (group) {
      group.push(record);
      continue;
    }
    ordered.push([record]);
    if (mofNo !== "") groups.set(mofNo, ordered[ordered.length - 1]);
  }

  const records = ordered.map((rows): PastedRecord<MofKey> => {
    const cells = { ...rows[0].cells };
    for (const key of Object.keys(cells) as MofKey[]) {
      const values = rows.map((row) => row.cells[key].replaceAll(JOIN, ""));
      if ((LINE_KEYS as readonly string[]).includes(key)) {
        cells[key] = values.join(JOIN);
      } else if (key !== "mofNo") {
        cells[key] = [...new Set(values.filter((value) => value !== ""))].join(
          JOIN,
        );
      }
    }
    return { line: rows[0].line, cells };
  });
  return { ...paste, records };
}

// Lets a MOF whose lines were not pasted pass the form's "at least one line" rule; never saved.
const UNCHANGED_LINE = {
  product: "-",
  stockType: "stock",
  supplier: "",
  qty: "0",
  unit: "pcs",
  areaM2: "0",
} as const;

export type MofImportContext = {
  team: readonly TeamMember[];
  /** Upper-case MOF no to the saved MOF's id and variation orders. */
  mofs: ReadonlyMap<string, { id: string; voAmount: number }>;
};

type PasteShape = { voPasted: boolean; linesPasted: boolean };

function mofImportSchema(
  fields: readonly ImportField<MofKey>[],
  context: MofImportContext,
  { voPasted, linesPasted }: PasteShape,
) {
  const labelOf = new Map(fields.map((field) => [field.key, field.label]));
  const seesCost = labelOf.has("cost");

  return cellsOf<MofKey>(fields)
    .transform((cells, ctx) => {
      const issues: string[] = [];
      const saved = context.mofs.get(cells.mofNo.toUpperCase());

      for (const [key, value] of Object.entries(cells)) {
        if (
          value.includes(JOIN) &&
          !(LINE_KEYS as readonly string[]).includes(key)
        ) {
          issues.push(
            `"${labelOf.get(key as MofKey)}" differs between rows of the same MOF.`,
          );
        }
      }

      const salespersonId = cells.salesperson
        ? personId(cells.salesperson, context.team, issues)
        : "";
      const secondSalespersonId = cells.secondSalesperson
        ? personId(cells.secondSalesperson, context.team, issues)
        : "";

      const choose = <T extends string>(
        value: string,
        fallback: T,
        options: readonly T[],
        labels: Record<T, string>,
        what: string,
      ): T => {
        if (value === "") return fallback;
        const found = matchOption(value, options, labels);
        if (!found) issues.push(`"${value}" is not a ${what}.`);
        return found ?? fallback;
      };
      const scope = choose(
        cells.scope,
        "s_and_l",
        JobScope.options,
        JobScopeLabel,
        "scope",
      );
      const commissionType = choose(
        cells.commissionType,
        "own",
        AccountType.options,
        AccountTypeLabel,
        "commission type",
      );
      const stage = choose(
        cells.stage,
        "pending_order",
        MofStage.options,
        MofStageLabel,
        "stage",
      );

      const pastedLines = linesPasted
        ? rowsOfLines(cells).map((line) => ({
            product: line.product,
            stockType: choose(
              line.stockType,
              "stock",
              StockType.options,
              StockTypeLabel,
              "stock type",
            ),
            supplier: line.supplier,
            qty: line.qty,
            unit: choose(
              line.unit,
              "m2",
              LineUnit.options,
              LineUnitLabel,
              "unit",
            ),
            areaM2: line.areaM2,
          }))
        : [];
      if (issues.length > 0) return rejectIssues(issues, ctx);

      return {
        form: {
          mofNo: cells.mofNo,
          loaDate: sheetDate(cells.loaDate),
          salespersonId,
          secondSalespersonId,
          projectId: "",
          companyName: cells.company,
          projectName: cells.project,
          loaNo: cells.loaNo,
          quoteNo: cells.quoteNo,
          siteAddress: cells.siteAddress,
          siteContactName: "",
          siteContactMobile: "",
          officePicId: "",
          customerContact: cells.customerContact,
          accountsContact: cells.accountsContact,
          // The paste has one contact column each; the separate boxes are for the form.
          customerName: "",
          customerMobile: "",
          accountsName: "",
          accountsMobile: "",
          accountsEmail: "",
          scope,
          installerName: cells.installer,
          contractSum: cells.contractSum,
          voAmount: voPasted ? cells.voAmount : String(saved?.voAmount ?? 0),
          retentionPct: cells.retention.replace("%", ""),
          invoiceNo: cells.invoiceNo,
          invoiceDate: sheetDate(cells.invoiceDate),
          commissionType,
          deliveryDate: sheetDate(cells.deliveryDate),
          stage,
          latestUpdate: cells.latestUpdate,
          lines: !linesPasted && saved ? [UNCHANGED_LINE] : pastedLines,
        },
        cost: seesCost ? cells.cost : "",
      };
    })
    .pipe(
      z.object({
        form: mofFormSchema,
        cost: z.union([
          z.literal("").transform(() => null),
          mofCostSchema.shape.cost,
        ]),
      }),
    );
}

function rowsOfLines(cells: Record<(typeof LINE_KEYS)[number], string>) {
  const columns = LINE_KEYS.map((key) => cells[key].split(JOIN));
  return columns[0]
    .map((_, index) => ({
      product: columns[0][index],
      stockType: columns[1][index],
      supplier: columns[2][index],
      qty: columns[3][index],
      unit: columns[4][index],
      areaM2: columns[5][index],
    }))
    .filter((line) => Object.values(line).some((value) => value !== ""));
}

export type MofImportRow = z.infer<ReturnType<typeof mofImportSchema>>;
export type MofImportPlan = ImportPlan<MofKey, MofImportRow>;

export function planMofImport(
  text: string,
  onDuplicate: DuplicateChoice,
  context: MofImportContext,
  fields: readonly ImportField<MofKey>[],
): MofImportPlan {
  const paste = groupByMof(mapPaste(text, fields));
  const pasted = new Set<MofKey>(paste.columns);
  return buildImportPlan({
    paste,
    schema: mofImportSchema(fields, context, {
      voPasted: pasted.has("voAmount"),
      linesPasted: LINE_KEYS.some((key) => pasted.has(key)),
    }),
    keyOf: (row) => row.form.mofNo,
    existing: new Map([...context.mofs].map(([mofNo, mof]) => [mofNo, mof.id])),
    onDuplicate,
  });
}

export function toMofImportPreview(
  plan: MofImportPlan,
  fields: readonly ImportField<MofKey>[],
) {
  const preview = toImportPreview(plan, fields);
  return {
    ...preview,
    rows: preview.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => cell.replaceAll(JOIN, " + ")),
    })),
  };
}

type Payload = Record<string, unknown>;

/**
 * Rows for the import_mofs database function: only rows to add or update. An update carries
 * the MOF id and only the pasted columns; a changed contract sum or VO goes through
 * update_mof_total inside the function, with the reason "Imported".
 */
export function mofImportPayload(plan: MofImportPlan): Payload[] {
  const pasted = new Set<string>(plan.columns);
  const has = (...keys: string[]) => keys.some((key) => pasted.has(key));
  const payload: Payload[] = [];

  for (const { action, row, existingId } of plan.rows) {
    if (!row || (action !== "add" && action !== "update")) continue;
    const { form, cost } = row;
    const lines = form.lines.map((line) => ({
      product: line.product,
      stock_type: line.stockType,
      supplier: line.supplier,
      qty: line.qty,
      unit: line.unit,
      area_m2: line.areaM2,
    }));
    const all: Payload = {
      mof_no: form.mofNo,
      loa_date: form.loaDate,
      salesperson_id: form.salespersonId,
      second_salesperson_id: form.secondSalespersonId,
      company_name: form.companyName,
      project_name: form.projectName,
      loa_no: form.loaNo,
      quote_no: form.quoteNo,
      site_address: form.siteAddress,
      customer_contact: form.customerContact,
      accounts_contact: form.accountsContact,
      scope: form.scope,
      installer_name: form.installerName,
      contract_sum: form.contractSum,
      vo_amount: form.voAmount,
      retention_pct: form.retentionPct,
      invoice_no: form.invoiceNo,
      invoice_date: form.invoiceDate,
      commission_type: form.commissionType,
      delivery_date: form.deliveryDate,
      stage: form.stage,
      latest_update: form.latestUpdate,
    };
    if (action === "add") {
      payload.push({
        ...all,
        lines,
        ...(cost === null ? {} : { cost }),
      });
      continue;
    }
    payload.push({
      id: existingId,
      ...pickKept(all, {
        mof_no: true,
        loa_date: true,
        salesperson_id: true,
        company_name: true,
        project_name: true,
        contract_sum: true,
        second_salesperson_id: has("secondSalesperson"),
        loa_no: has("loaNo"),
        quote_no: has("quoteNo"),
        site_address: has("siteAddress"),
        customer_contact: has("customerContact"),
        accounts_contact: has("accountsContact"),
        scope: has("scope"),
        installer_name: has("installer"),
        vo_amount: has("voAmount"),
        retention_pct: has("retention"),
        invoice_no: has("invoiceNo"),
        invoice_date: has("invoiceDate"),
        commission_type: has("commissionType"),
        delivery_date: has("deliveryDate"),
        stage: has("stage"),
        latest_update: has("latestUpdate"),
      }),
      ...(has(...LINE_KEYS) ? { lines } : {}),
      ...(has("cost") && cost !== null ? { cost } : {}),
    });
  }
  return payload;
}
