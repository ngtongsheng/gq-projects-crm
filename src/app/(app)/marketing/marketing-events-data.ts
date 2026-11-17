import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MarketingEvent } from "./marketing-types";

const eventRows = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    starts_on: z.iso.date().nullable(),
    ends_on: z.iso.date().nullable(),
    venue: z.string().nullable(),
    budget: z.number().nullable(),
    notes: z.string().nullable(),
    marketing_event_costs: z.array(
      z.object({
        id: z.uuid(),
        cost_group: z.string(),
        description: z.string().nullable(),
        supplier_ref: z.string().nullable(),
        foreign_amount: z.string().nullable(),
        rate: z.number(),
        unit: z.string(),
        qty: z.number(),
        total: z.number(),
        remarks: z.string().nullable(),
        created_at: z.string(),
      }),
    ),
  }),
);

/** Every event with the lines of its own cost sheet, newest event first. */
export async function loadMarketingEvents(): Promise<MarketingEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_events")
    .select(
      "id, name, starts_on, ends_on, venue, budget, notes, marketing_event_costs(id, cost_group, description, supplier_ref, foreign_amount, rate, unit, qty, total, remarks, created_at)",
    )
    .order("starts_on", { ascending: false, nullsFirst: false })
    .order("name");
  if (error) {
    throw new Error(`Could not load marketing events: ${error.message}`);
  }
  return eventRows.parse(data).map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    venue: row.venue,
    budget: row.budget,
    notes: row.notes,
    costs: row.marketing_event_costs
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
      .map((cost) => ({
        id: cost.id,
        costGroup: cost.cost_group,
        description: cost.description,
        supplierRef: cost.supplier_ref,
        foreignAmount: cost.foreign_amount,
        rate: cost.rate,
        unit: cost.unit,
        qty: cost.qty,
        total: cost.total,
        remarks: cost.remarks,
      })),
  }));
}
