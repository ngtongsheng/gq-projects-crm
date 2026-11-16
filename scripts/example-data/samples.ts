import { addDays } from "../../src/lib/format/date.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

const sampleId = (key: string) => exampleId("samples", key);
const pickupId = (key: string) => exampleId("sample_pickups", key);

/**
 * Samples at Best Link, two pickup forms and the moves they cause. A sample is added with what
 * is there now; the database logs that as its first move and every take-out lowers the quantity,
 * so the quantities here are the starting ones and no move takes out more than is there.
 */
export function buildSamples({ people, today }: BuildContext): ExampleTable[] {
  const sampleSeeds: Array<
    [string, string, string, string, string, number, string, string | null]
  > = [
    // key, product, brand, sku, name, starting qty, unit, spec
    [
      "s1",
      "Carpet tile",
      "Unijoy",
      "UNJ-CT-37",
      "Slate grey",
      12,
      "pc",
      "50x50cm",
    ],
    [
      "s2",
      "Vinyl tile",
      "Dawn",
      "XCH-03",
      "Dawn to Dust",
      20,
      "pc",
      "25×100cm",
    ],
    [
      "s3",
      "Carpet tile",
      "Halcyon",
      "HCM-TILE-SLATE",
      "Halcyon Slate",
      6,
      "pc",
      "50x50cm",
    ],
    [
      "s4",
      "Catalogue",
      "Orbis",
      "ORB-CAT-2026",
      "Orbis 2026 catalogue",
      3,
      "catalogue",
      null,
    ],
    ["s5", "Vinyl tile", "Orbis", "ORB-VPL-ASH", "Orbis Ash", 2, "pc", null],
  ];
  const samples: Row[] = sampleSeeds.map(
    ([key, product, brand, sku, name, qty, unit, spec]) => ({
      id: sampleId(key),
      product,
      brand,
      sku,
      name,
      qty,
      unit,
      spec,
      notes: key === "s2" ? "Rack B2 · 1 box = 20 pcs" : null,
    }),
  );

  const pickups: Row[] = [
    {
      id: pickupId("p1"),
      running_no: 1,
      form_date: addDays(today, -3),
      person_in_charge: "Vernice",
      contact: "012-3456789",
      method: "lalamove",
      appointment_on: addDays(today, -2),
      driver_contact: "011-23456789",
      vehicle_no: "WXY 1234",
      address: "Best Link warehouse, Klang",
      taken_by: people.vernice,
      for_whom: "Kiara Boutique Hotel, Ms Hana",
      pdf_saved_at: at(today, -3, "11:20"),
    },
    {
      id: pickupId("p2"),
      running_no: 2,
      form_date: today,
      person_in_charge: "Cavan",
      contact: "017-8899001",
      method: "self_pickup",
      appointment_on: addDays(today, 1),
      taken_by: people.cavan,
      for_whom: "SLA Architects, Alan",
    },
  ];

  const lineSeeds: Array<
    [string, number, string | null, string, string | null, number, string]
  > = [
    // pickup, position, sample, product name, spec, qty, unit
    ["p1", 1, "s1", "UNJ-CT-37", "50x50cm", 4, "pc"],
    ["p1", 2, "s2", "XCH-03", "25×100cm", 3, "pc"],
    // A sample that is not in the list takes nothing out of Best Link.
    ["p2", 1, null, "37,PRI-04", "(37) 25×100cm", 2, "pc"],
  ];
  const lines: Row[] = lineSeeds.map(
    ([pickup, position, sample, productName, spec, qty, unit]) => ({
      id: exampleId("sample_pickup_lines", `${pickup}:${position}`),
      pickup_id: pickupId(pickup),
      position,
      sample_id: sample === null ? null : sampleId(sample),
      product_name: productName,
      spec,
      qty,
      unit,
    }),
  );

  const moveSeeds: Array<
    [
      string,
      string,
      string,
      number,
      number,
      string | null,
      string,
      string | null,
    ]
  > = [
    // key, sample, kind, qty, days ago, person, for whom, pickup
    [
      "mv1",
      "s1",
      "out",
      4,
      3,
      "vernice",
      "Kiara Boutique Hotel, Ms Hana",
      "p1",
    ],
    [
      "mv2",
      "s2",
      "out",
      3,
      3,
      "vernice",
      "Kiara Boutique Hotel, Ms Hana",
      "p1",
    ],
    ["mv3", "s3", "out", 2, 6, "cavan", "SLA Architects, Alan", null],
    // The client keeps it: it does not come back.
    ["mv4", "s4", "kept", 1, 9, "crystal", "Harbour Studio", null],
    // Nothing left of this one.
    ["mv5", "s5", "out", 2, 12, "crystal", "Meridian Showroom", null],
  ];
  const moves: Row[] = moveSeeds.map(
    ([key, sample, kind, qty, ago, person, forWhom, pickup]) => ({
      id: exampleId("sample_moves", key),
      sample_id: sampleId(sample),
      kind,
      qty,
      moved_on: addDays(today, -ago),
      taken_by: person === null ? null : people[person as keyof typeof people],
      for_whom: forWhom,
      pickup_id: pickup === null ? null : pickupId(pickup),
    }),
  );

  return [
    // The database made the one settings row; only the two links are set.
    {
      table: "sample_pickup_settings",
      key: "id",
      rows: [
        {
          id: true,
          best_link_whatsapp: "60123450000",
          drive_folder_url:
            "https://drive.google.com/drive/folders/example-best-link-pickups",
        },
      ],
      onConflict: "id",
      clearedByParent: true,
    },
    // Deleting a pickup form files its number here, and the number cannot be filed twice, so the
    // reset clears the numbers the example forms leave behind. Listed first: it is cleared last.
    {
      table: "cancelled_sample_pickup_numbers",
      key: "running_no",
      rows: [],
      cleanupKeys: pickups.map((pickup) => String(pickup.running_no)),
    },
    { table: "samples", key: "id", rows: samples },
    { table: "sample_pickups", key: "id", rows: pickups },
    { table: "sample_pickup_lines", key: "id", rows: lines },
    { table: "sample_moves", key: "id", rows: moves },
  ];
}
