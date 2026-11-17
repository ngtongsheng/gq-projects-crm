import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Giveaway } from "./marketing-types";

const giveawayRows = z.array(
  z.object({
    id: z.uuid(),
    given_on: z.iso.date(),
    supplier: z.string().nullable(),
    invoice_no: z.string().nullable(),
    item: z.string(),
    given_to: z.string(),
    qty: z.number(),
    unit_cost: z.number(),
    total: z.number(),
  }),
);

/** Every line of the give-away register. Search and order happen in the browser. */
export async function loadGiveaways(): Promise<Giveaway[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_giveaways")
    .select(
      "id, given_on, supplier, invoice_no, item, given_to, qty, unit_cost, total",
    );
  if (error) {
    throw new Error(`Could not load give-aways: ${error.message}`);
  }
  return giveawayRows.parse(data).map((row) => ({
    id: row.id,
    givenOn: row.given_on,
    supplier: row.supplier,
    invoiceNo: row.invoice_no,
    item: row.item,
    givenTo: row.given_to,
    qty: row.qty,
    unitCost: row.unit_cost,
    total: row.total,
  }));
}
