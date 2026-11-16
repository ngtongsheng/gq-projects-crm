import { addDays } from "../../src/lib/format/date.ts";
import { projectId } from "./customers.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { mofId } from "./orders.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

const leftoverId = (key: string) => exampleId("leftovers", key);

/**
 * Leftover stock in every status. The database stamps who collected and who received an item
 * when it is added in that status (nobody, from here), so those two columns are left out.
 */
export function buildLeftovers({ people, today }: BuildContext): ExampleTable {
  const seeds: Array<Row & { key: string; mof: string }> = [
    {
      // Collected, transport arranged and the office told: waiting for the pickup day.
      key: "lo1",
      mof: "m4",
      item: "Halcyon Carpet Tile Slate",
      qty: 3,
      unit: "box",
      condition: "good",
      destination: "supplier",
      status: "pending_pickup",
      note: "Boxes sealed, stored at the site office.",
      supplier: "Halcyon Carpet Mills",
      return_method: "transport",
      transport_by: "Lalamove",
      transport_on: addDays(today, 1),
      transport_to: "Halcyon Carpet Mills, Shah Alam",
      transport_cost: 85,
      whatsapp_sent_at: at(today, -1, "17:05"),
    },
    {
      key: "lo2",
      mof: "m5",
      item: "Orbis Vinyl Plank offcuts",
      qty: 18,
      unit: "pcs",
      condition: "offcut",
      destination: "gq",
      status: "at_best_link",
      note: null,
      keep_reason: "custom_made",
      return_method: "installer",
    },
    {
      key: "lo3",
      mof: "m4",
      item: "Halcyon Carpet Tile Slate",
      qty: 5,
      unit: "box",
      condition: "good",
      destination: "supplier",
      status: "returned_to_supplier",
      note: null,
      credit_note_no: "CN-2026-0087",
      credit_note_amount: 1240,
      supplier: "Halcyon Carpet Mills",
      return_method: "supervisor",
      whatsapp_sent_at: at(today, -20, "16:30"),
    },
    {
      key: "lo4",
      mof: "m1",
      item: "Underlay 8mm",
      qty: 12,
      unit: "roll",
      condition: "damaged",
      destination: "gq",
      status: "disposed",
      note: "Water damage in transit.",
    },
    {
      // Asked for transport and nobody has arranged it yet.
      key: "lo5",
      mof: "m2",
      item: "Orbis Vinyl Plank Oak",
      qty: 6,
      unit: "box",
      condition: "good",
      destination: "supplier",
      status: "pending_pickup",
      note: null,
      supplier: "Orbis Floors",
      return_method: "transport",
      whatsapp_sent_at: at(today, 0, "09:10"),
    },
    {
      // The supervisor has it in the car and is taking it to the supplier.
      key: "lo6",
      mof: "m3",
      item: "Underlay 8mm",
      qty: 4,
      unit: "roll",
      condition: "good",
      destination: "supplier",
      status: "collected_by_supervisor",
      note: null,
      supplier: "Best Link Stock",
      return_method: "supervisor",
      collected_to: "Best Link warehouse, Klang",
      whatsapp_sent_at: at(today, -1, "12:00"),
    },
    {
      key: "lo7",
      mof: "m6",
      item: "Carpet Tile Graphite",
      qty: 2,
      unit: "box",
      condition: "good",
      destination: "gq",
      status: "left_with_client",
      note: "Client keeps it for repairs.",
      keep_reason: "ordered_wrong",
      ordered_wrong_by: people.vernice,
    },
    {
      // All of it has gone to projects.
      key: "lo8",
      mof: "m5",
      item: "Axminster Garnet offcut",
      qty: 4,
      unit: "roll",
      condition: "offcut",
      destination: "gq",
      status: "at_best_link",
      note: null,
      keep_reason: "indent_from_china",
      return_method: "supervisor",
    },
  ];
  const rows: Row[] = seeds.map(({ key, mof, ...row }) => ({
    id: leftoverId(key),
    mof_id: mofId(mof),
    ...row,
  }));
  return { table: "leftovers", key: "id", rows };
}

/**
 * Leftover stock at Best Link used for other projects. The database refuses an allocation that
 * is past what is left, so these add up to no more than each item's quantity.
 */
export function buildLeftoverAllocations({
  today,
}: BuildContext): ExampleTable {
  const seeds: Array<[string, string, string, number, number, string | null]> =
    [
      // key, leftover, project, qty, days ago, note
      ["la1", "lo2", "kiara-cafe", 6, 9, "Skirting offcuts for the lounge."],
      ["la2", "lo2", "harbour-studio", 4, 4, null],
      ["la3", "lo8", "orion-tower", 4, 7, "Sold at RM 95 per roll."],
    ];
  const rows: Row[] = seeds.map(([key, leftover, project, qty, ago, note]) => ({
    id: exampleId("leftover_allocations", key),
    leftover_id: leftoverId(leftover),
    project_id: projectId(project),
    qty,
    allocated_on: addDays(today, -ago),
    note,
  }));
  return { table: "leftover_allocations", key: "id", rows };
}
