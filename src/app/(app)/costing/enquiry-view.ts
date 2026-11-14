import { z } from "zod";
import { landedPerM2 } from "@/lib/domain/costing";
import { fromCents, toCents } from "@/lib/format/money";

/**
 * A FOB enquiry as the database returns it and as the screens show it. Purchasing's reply (FOB,
 * rate, shipping) turns into the landed cost the salesperson keys into their costing.
 */

export const EnquiryUnit = z.enum(["m2", "sqft", "pc", "m"]);
export type EnquiryUnit = z.infer<typeof EnquiryUnit>;

export const EnquiryUnitLabel: Record<EnquiryUnit, string> = {
  m2: "m²",
  sqft: "sqft",
  pc: "pc",
  m: "m",
};

export const EnquiryCurrency = z.enum(["USD", "RMB"]);
export type EnquiryCurrency = z.infer<typeof EnquiryCurrency>;

// The same starting rates as a new costing (quote_revisions.fx_usd and fx_rmb defaults).
export const DEFAULT_FX: Record<EnquiryCurrency, number> = {
  USD: 4.5,
  RMB: 0.6024,
};

export const ENQUIRY_SELECT = `id, enquiry_date, quote_no, salesperson_id, product, sizes, qty, unit, supplier, currency,
  fob, fx, shipping, notes, status, replied_by, replied_at, recorded_by, created_at`;

const amount = z.number().nullable();
const text = z.string().nullable();

export const EnquiryRow = z.object({
  id: z.string(),
  enquiry_date: z.string(),
  quote_no: text,
  salesperson_id: text,
  product: text,
  sizes: text,
  qty: amount,
  unit: EnquiryUnit,
  supplier: text,
  currency: EnquiryCurrency,
  fob: amount,
  fx: amount,
  shipping: amount,
  notes: text,
  status: z.enum(["pending", "replied"]),
  replied_by: text,
  replied_at: text,
  recorded_by: text,
  created_at: z.string(),
});
export type EnquiryRow = z.infer<typeof EnquiryRow>;

export type EnquiryView = {
  id: string;
  date: string;
  quoteNo: string;
  salespersonId: string | null;
  salespersonName: string;
  product: string;
  sizes: string;
  qty: number | null;
  unit: EnquiryUnit;
  supplier: string;
  currency: EnquiryCurrency;
  fob: number | null;
  fx: number | null;
  shipping: number | null;
  notes: string;
  status: "pending" | "replied";
  repliedByName: string | null;
  repliedAt: string | null;
  requestedByName: string;
  createdAt: string;
  /** Per unit of the enquiry, in RM; null until purchasing has replied. */
  landed: { perUnit: number; total: number | null } | null;
};

export type EnquiryViewContext = {
  sstPct: number;
  personName: (id: string) => string;
};

const rm = (value: number) => fromCents(toCents(value));

/** FOB x rate x (1 + SST) + shipping, as in the costing; a blank rate falls back to the usual one. */
export function enquiryLanded(
  row: Pick<EnquiryRow, "currency" | "fob" | "fx" | "shipping" | "qty">,
  sstPct: number,
): EnquiryView["landed"] {
  if (!row.fob || row.fob <= 0) return null;
  const perUnit = rm(
    landedPerM2({
      fob: row.fob,
      fx: row.fx || DEFAULT_FX[row.currency],
      sstPct,
      shipping: row.shipping,
    }),
  );
  return { perUnit, total: row.qty ? rm(perUnit * row.qty) : null };
}

export function toEnquiryView(
  row: EnquiryRow,
  context: EnquiryViewContext,
): EnquiryView {
  return {
    id: row.id,
    date: row.enquiry_date,
    quoteNo: row.quote_no ?? "",
    salespersonId: row.salesperson_id,
    salespersonName: row.salesperson_id
      ? context.personName(row.salesperson_id)
      : "",
    product: row.product ?? "",
    sizes: row.sizes ?? "",
    qty: row.qty,
    unit: row.unit,
    supplier: row.supplier ?? "",
    currency: row.currency,
    fob: row.fob,
    fx: row.fx,
    shipping: row.shipping,
    notes: row.notes ?? "",
    status: row.status,
    repliedByName: row.replied_by ? context.personName(row.replied_by) : null,
    repliedAt: row.replied_at,
    requestedByName: row.recorded_by ? context.personName(row.recorded_by) : "",
    createdAt: row.created_at,
    landed: enquiryLanded(row, context.sstPct),
  };
}

/** Matches the search words against the enquiry's text, like the demo's search box. */
export function searchEnquiries(
  enquiries: EnquiryView[],
  search: string,
): EnquiryView[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return enquiries;
  return enquiries.filter((enquiry) => {
    const haystack = [
      enquiry.quoteNo,
      enquiry.salespersonName,
      enquiry.product,
      enquiry.supplier,
      enquiry.notes,
      enquiry.sizes,
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Waiting for a reply, oldest first; and replied, newest reply first. */
export function splitEnquiries(enquiries: EnquiryView[]): {
  pending: EnquiryView[];
  replied: EnquiryView[];
} {
  return {
    pending: enquiries
      .filter((enquiry) => enquiry.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    replied: enquiries
      .filter((enquiry) => enquiry.status === "replied")
      .sort((a, b) =>
        (b.repliedAt ?? b.date).localeCompare(a.repliedAt ?? a.date),
      ),
  };
}
