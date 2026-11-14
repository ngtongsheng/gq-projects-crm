import { addDays } from "../../src/lib/format/date.ts";
import { projectId } from "./customers.ts";
import { exampleId } from "./ids.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

export const mofId = (key: string) => exampleId("mofs", key);

type MofSeed = {
  key: string;
  mofNo: string;
  project: string | null;
  salesperson: keyof BuildContext["people"];
  second: keyof BuildContext["people"] | null;
  company: string;
  projectName: string;
  address: string;
  siteContact: [string, string];
  scope: "s_and_l" | "supply" | "labour";
  installer: string | null;
  contractSum: number;
  vo: number;
  retention: number;
  commissionType: "own" | "pass_down" | "company";
  stage: string;
  siteStage: string;
  loaDaysAgo: number;
  deliveryInDays: number | null;
  invoice: string | null;
  update: string;
  cost: number;
  lines: Array<
    [
      string,
      "stock" | "indent" | "custom",
      string,
      number,
      "sqft" | "m2" | "roll" | "pcs",
      number,
    ]
  >;
};

const MOFS: MofSeed[] = [
  {
    key: "m1",
    mofNo: "MOF-2026-014",
    project: "sutera-ballroom",
    salesperson: "vernice",
    second: "vicky",
    company: "Sutera Hospitality Group",
    projectName: "Sutera Ballroom Refurbishment",
    address: "1 Jalan Sutera, 50250 Kuala Lumpur",
    siteContact: ["Imran Shah", "60125550111"],
    scope: "s_and_l",
    installer: "Apex Installers",
    contractSum: 188000,
    vo: 6500,
    retention: 5,
    commissionType: "own",
    stage: "delivered_installing",
    siteStage: "installation",
    loaDaysAgo: 60,
    deliveryInDays: -12,
    invoice: "INV-26-0412",
    update: "Carpet delivered; installation is halfway through the ballroom.",
    cost: 131000,
    lines: [
      [
        "Halcyon Broadloom Axminster Garnet",
        "indent",
        "Halcyon Carpet Mills",
        1180,
        "m2",
        1180,
      ],
      ["Underlay 8mm", "stock", "Best Link Stock", 1180, "m2", 1180],
    ],
  },
  {
    key: "m2",
    mofNo: "MOF-2026-016",
    project: "rimba-unit",
    salesperson: "vernice",
    second: null,
    company: "Bukit Rimba Development",
    projectName: "Rimba Show Unit Package",
    address: "Rimba Residences Sales Gallery, Cheras",
    siteContact: ["Sharon Gill", "60125550107"],
    scope: "supply",
    installer: "Steady Hands Flooring",
    contractSum: 96000,
    vo: 0,
    retention: 10,
    commissionType: "pass_down",
    stage: "shipping",
    siteStage: "shipment",
    loaDaysAgo: 35,
    deliveryInDays: 10,
    invoice: null,
    update: "Containers left the mill; arrival expected next week.",
    cost: 66500,
    lines: [
      [
        "Halcyon Carpet Tile 50x50 Slate",
        "indent",
        "Halcyon Carpet Mills",
        5400,
        "sqft",
        501.6,
      ],
      ["Adhesive tiles tape", "stock", "Best Link Stock", 40, "pcs", 0],
    ],
  },
  {
    key: "m3",
    mofNo: "MOF-2026-018",
    project: "kiara-cafe",
    salesperson: "eddie",
    second: null,
    company: "Kiara Design Studio",
    projectName: "Kiara Cafe Flooring",
    address: "8 Jalan Kiara, 50480 Kuala Lumpur",
    siteContact: ["Marcus Lee", "60125550104"],
    scope: "s_and_l",
    installer: "Apex Installers",
    contractSum: 36000,
    vo: 0,
    retention: 0,
    commissionType: "own",
    stage: "ordered",
    siteStage: "start",
    loaDaysAgo: 14,
    deliveryInDays: 28,
    invoice: null,
    update: "Order placed with the mill, waiting for the production slot.",
    cost: 24800,
    lines: [
      [
        "Orbis Vinyl Plank Oak Natural",
        "custom",
        "Orbis Floors",
        1800,
        "sqft",
        167.2,
      ],
    ],
  },
  {
    key: "m4",
    mofNo: "MOF-2026-009",
    project: null,
    salesperson: "vernice",
    second: null,
    company: "Meridian Interiors Sdn Bhd",
    projectName: "Meridian Office Reception",
    address: "12 Jalan Setiawangsa, 54200 Kuala Lumpur",
    siteContact: ["Aiman Rahim", "60125550101"],
    scope: "s_and_l",
    installer: "Apex Installers",
    contractSum: 54200,
    vo: -1200,
    retention: 5,
    commissionType: "own",
    stage: "completed_payment_pending",
    siteStage: "completed",
    loaDaysAgo: 120,
    deliveryInDays: -75,
    invoice: "INV-26-0233",
    update: "Handed over; waiting for the final payment.",
    cost: 37900,
    lines: [
      [
        "Halcyon Carpet Tile 50x50 Slate",
        "stock",
        "Halcyon Carpet Mills",
        2400,
        "sqft",
        223,
      ],
      [
        "Orbis Vinyl Plank Oak Natural",
        "indent",
        "Orbis Floors",
        900,
        "sqft",
        83.6,
      ],
    ],
  },
  {
    key: "m5",
    mofNo: "MOF-2026-005",
    project: null,
    salesperson: "vanessa",
    second: null,
    company: "Orion Builders Sdn Bhd",
    projectName: "Orion Site Office Flooring",
    address: "Lot 5, Jalan Perindustrian 3, 47100 Puchong",
    siteContact: ["Kamal Ariffin", "60125550105"],
    scope: "supply",
    installer: null,
    contractSum: 31800,
    vo: 0,
    retention: 0,
    commissionType: "own",
    stage: "closed",
    siteStage: "completed",
    loaDaysAgo: 200,
    deliveryInDays: -170,
    invoice: "INV-26-0102",
    update: "Closed, fully paid.",
    cost: 22300,
    lines: [
      [
        "Orbis Vinyl Plank Oak Natural",
        "stock",
        "Orbis Floors",
        3400,
        "sqft",
        315.9,
      ],
    ],
  },
  {
    key: "m6",
    mofNo: "MOF-2026-020",
    project: null,
    salesperson: "vernice",
    second: null,
    company: "Harbourline Architects",
    projectName: "Harbourline Meeting Rooms",
    address: "3 Persiaran Harbour, 40000 Shah Alam",
    siteContact: ["Ethan Lau", "60125550108"],
    scope: "s_and_l",
    installer: null,
    contractSum: 22000,
    vo: 0,
    retention: 0,
    commissionType: "own",
    stage: "pending_order",
    siteStage: "start",
    loaDaysAgo: 3,
    deliveryInDays: null,
    invoice: null,
    update: "Waiting for the client's colour sign-off.",
    cost: 15400,
    lines: [
      [
        "Halcyon Carpet Tile 50x50 Graphite",
        "stock",
        "Halcyon Carpet Mills",
        1600,
        "sqft",
        148.6,
      ],
    ],
  },
  {
    key: "m7",
    mofNo: "MOF-2025-088",
    project: null,
    salesperson: "eddie",
    second: null,
    company: "Pinnacle Main Contractors",
    projectName: "Pinnacle Podium Level",
    address: "27 Jalan Teknologi, 47810 Petaling Jaya",
    siteContact: ["Zulkifli Hamid", "60125550109"],
    scope: "supply",
    installer: null,
    contractSum: 18000,
    vo: 0,
    retention: 0,
    commissionType: "company",
    stage: "on_hold",
    siteStage: "ongoing",
    loaDaysAgo: 150,
    deliveryInDays: 20,
    invoice: null,
    update: "On hold while the site is not ready.",
    cost: 12600,
    lines: [
      [
        "Orbis Vinyl Plank Oak Natural",
        "stock",
        "Orbis Floors",
        1400,
        "sqft",
        130,
      ],
    ],
  },
];

export function buildMofs({ people, today }: BuildContext): ExampleTable[] {
  const mofs: Row[] = MOFS.map((m) => ({
    id: mofId(m.key),
    mof_no: m.mofNo,
    loa_date: addDays(today, -m.loaDaysAgo),
    salesperson_id: people[m.salesperson],
    second_salesperson_id: m.second ? people[m.second] : null,
    project_id: m.project ? projectId(m.project) : null,
    company_name: m.company,
    project_name: m.projectName,
    site_address: m.address,
    site_contact_name: m.siteContact[0],
    site_contact_mobile: m.siteContact[1],
    office_pic_id: people.waimun,
    scope: m.scope,
    installer_name: m.installer,
    contract_sum: m.contractSum,
    vo_amount: m.vo,
    retention_pct: m.retention,
    invoice_no: m.invoice,
    invoice_date: m.invoice ? addDays(today, -m.loaDaysAgo + 20) : null,
    commission_type: m.commissionType,
    delivery_date:
      m.deliveryInDays === null ? null : addDays(today, m.deliveryInDays),
    stage: m.stage,
    site_stage: m.siteStage,
    latest_update: m.update,
    payment_checked:
      m.stage === "closed" || m.stage === "completed_payment_pending",
    approvals_in_writing: m.loaDaysAgo > 30,
    artwork_signed_off: m.loaDaysAgo > 30,
    dos_pre_approved: m.loaDaysAgo > 100,
  }));
  const lines: Row[] = MOFS.flatMap((m) =>
    m.lines.map(([product, stockType, supplier, qty, unit, area], index) => ({
      id: exampleId("mof_lines", `${m.key}-${index}`),
      mof_id: mofId(m.key),
      product,
      stock_type: stockType,
      supplier,
      qty,
      unit,
      area_m2: area,
    })),
  );
  const costs: Row[] = MOFS.map((m) => ({
    mof_id: mofId(m.key),
    cost: m.cost,
  }));
  return [
    { table: "mofs", key: "id", rows: mofs },
    { table: "mof_lines", key: "id", rows: lines },
    { table: "mof_costs", key: "mof_id", rows: costs },
    // Filled by the app when an order total changes; cleaned so a reset is never blocked.
    {
      table: "mof_total_changes",
      key: "mof_id",
      rows: [],
      cleanupKeys: MOFS.map((m) => mofId(m.key)),
    },
  ];
}

export function buildSupplierPos({ today }: BuildContext): ExampleTable {
  const seeds: Array<[string, string, string, string, number, number, string]> =
    [
      // key, mof, zoho no, supplier, days ago, lead days, status
      ["s1", "m1", "9101", "Halcyon Carpet Mills", 70, 45, "delivered"],
      ["s2", "m2", "9102", "Halcyon Carpet Mills", 30, 40, "shipping"],
      ["s3", "m3", "9103", "Orbis Floors", 12, 55, "in_production"],
      ["s4", "m4", "9104", "Orbis Floors", 100, 30, "delivered"],
      ["s5", "m6", "9105", "Halcyon Carpet Mills", 1, 21, "pending_order"],
      ["s6", "m2", "9106", "Orbis Floors", 28, 35, "at_kl_supplier_warehouse"],
    ];
  const rows: Row[] = seeds.map(
    ([key, mof, zoho, supplier, ago, lead, status]) => ({
      id: exampleId("supplier_pos", key),
      mof_id: mofId(mof),
      zoho_no: zoho,
      supplier,
      po_date: addDays(today, -ago),
      lead_time_days: lead,
      status,
      notes: null,
    }),
  );
  return { table: "supplier_pos", key: "id", rows };
}

export function buildInstallerClaims({ today }: BuildContext): ExampleTable[] {
  const poSeeds: Array<
    [string, string, string, string, number, number, number]
  > = [
    // key, mof, po no, installer, amount, retention, days ago
    ["ip1", "m1", "IPO-0141", "Apex Installers", 28000, 5, 45],
    ["ip2", "m4", "IPO-0092", "Apex Installers", 9000, 5, 90],
    ["ip3", "m2", "IPO-0160", "Steady Hands Flooring", 15000, 10, 5],
  ];
  const pos: Row[] = poSeeds.map(
    ([key, mof, poNo, installer, amount, retention, ago]) => ({
      id: exampleId("installer_pos", key),
      mof_id: mofId(mof),
      po_no: poNo,
      po_date: addDays(today, -ago),
      installer,
      amount,
      scope: "Supply and lay, including skirting",
      retention_pct: retention,
    }),
  );
  // Verification and payment need a signed-in supervisor or accountant, so the example
  // claims stay unverified and unpaid.
  const claimSeeds: Array<
    [string, string, string, string | null, number, number]
  > = [
    // key, po, type, claim no, amount, days ago
    ["ic1", "ip1", "progress", "CLM-001", 14000, 20],
    ["ic2", "ip1", "deduction", null, 1200, 12],
    ["ic3", "ip2", "final", "CLM-001", 9000, 60],
  ];
  const claims: Row[] = claimSeeds.map(
    ([key, po, claimType, claimNo, amount, ago]) => ({
      id: exampleId("installer_claims", key),
      installer_po_id: exampleId("installer_pos", po),
      claim_type: claimType,
      claim_no: claimNo,
      amount,
      claimed_on: addDays(today, -ago),
    }),
  );
  return [
    { table: "installer_pos", key: "id", rows: pos },
    { table: "installer_claims", key: "id", rows: claims },
  ];
}

export function buildMoney({ people, today }: BuildContext): ExampleTable[] {
  const paymentSeeds: Array<[string, string, number, number, string | null]> = [
    // key, mof, amount, days ago, note
    ["pay1", "m1", 97250, 40, "50% deposit"],
    ["pay2", "m1", 80000, 8, "Progress payment"],
    ["pay3", "m2", 28800, 30, "30% deposit"],
    ["pay4", "m4", 48780, 50, "Progress payment"],
    ["pay5", "m5", 15900, 190, "Deposit"],
    ["pay6", "m5", 15900, 160, "Balance"],
  ];
  const payments: Row[] = paymentSeeds.map(([key, mof, amount, ago, note]) => ({
    id: exampleId("payments", key),
    mof_id: mofId(mof),
    amount,
    received_on: addDays(today, -ago),
    note,
  }));
  const payoutSeeds: Array<
    [string, keyof BuildContext["people"], string, number, number]
  > = [
    // key, person, mof, amount, days ago. The database refuses a payout past what is payable
    // (commission_payable_now), so these stay under it: m5 low margin 1.5% of 31,800 is exactly
    // 477; m4 is 1.5% of the 48,780 received; m1 has passed the 90% collected mark (pay1 + pay2
    // are 91%) and Vernice's half share earns 3% of 177,250.
    ["pout1", "vanessa", "m5", 477, 150],
    ["pout2", "vernice", "m4", 500, 45],
    ["pout3", "vernice", "m1", 2400, 7],
  ];
  const payouts: Row[] = payoutSeeds.map(([key, person, mof, amount, ago]) => ({
    id: exampleId("commission_payouts", key),
    profile_id: people[person],
    mof_id: mofId(mof),
    amount,
    paid_on: addDays(today, -ago),
    note: null,
  }));
  return [
    { table: "payments", key: "id", rows: payments },
    { table: "commission_payouts", key: "id", rows: payouts },
  ];
}
