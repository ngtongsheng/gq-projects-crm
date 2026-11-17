import { Workbook } from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildMarketingWorkbook,
  type MarketingExport,
} from "./marketing-excel-export";
import { parseMarketingWorkbook } from "./marketing-excel-import";

const FOLDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHERS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FAIR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const known = {
  categories: [
    { id: FOLDER, name: "Folder" },
    { id: OTHERS, name: "Others" },
  ],
  events: [{ id: FAIR, name: "Spring Fair" }],
};

let counter = 0;
const nextId = () =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const serial = (year: number, month: number, day: number) =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;

type Row = (string | number | Date | null)[];

async function workbookWith(
  sheets: Record<string, Row[]>,
): Promise<ArrayBuffer> {
  const workbook = new Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    for (const row of rows) sheet.addRow(row);
  }
  return workbook.xlsx.writeBuffer();
}

const EXPENSE_HEAD = [
  "Date",
  "Category",
  "Campaign / event",
  "Description",
  "Vendor",
  "Invoice / ref no.",
  "Currency",
  "Amount",
  "Amount (RM)",
  "Payment method",
  "Remarks",
];

describe("importing a workbook in the demo's layout", () => {
  it("recognises each kind of sheet by its heading row", async () => {
    const file = await workbookWith({
      "Any name": [
        EXPENSE_HEAD,
        [
          "05/03/2026",
          "Folder",
          "Spring Fair",
          "Folders",
          "Print Co",
          "INV-1",
          "RM",
          120,
          120,
          "Cash",
          null,
        ],
      ],
      Deposits: [
        [
          "Date",
          "Vendor",
          "Description / project",
          "Ref / MOF",
          "Top-up (RM)",
          "Used (RM)",
          "Marketing?",
          "Remarks",
        ],
        ["2026-03-06", "Print Co", "Top-up", null, 1000, null, null, null],
        [
          "2026-03-07",
          "Print Co",
          "Acme - Lobby",
          "MOF-9",
          null,
          250,
          "yes",
          null,
        ],
      ],
      Samples: [
        [
          "Date",
          "Supplier",
          "Invoice no.",
          "Item",
          "Given to (client / project)",
          "Qty",
          "Unit cost",
          "Total (RM)",
        ],
        ["2026-03-08", "Mill", "S-1", "Catalogue", "Acme", 3, 12.5, 37.5],
      ],
      "Spring Fair": [
        [
          "Cost group",
          "Description",
          "Supplier / ref",
          "Foreign amount",
          "Rate (RM)",
          "Unit",
          "Qty",
          "Total (RM)",
          "Remarks",
        ],
        [
          "Booth",
          "Shell scheme",
          "Expo",
          "RMB 2700",
          1500,
          "ls",
          2,
          3000,
          null,
        ],
      ],
      Vendors: [
        ["Vendor", "Type"],
        ["Print Co", "Company"],
      ],
    });

    const plan = await parseMarketingWorkbook(file, known, nextId);

    expect(plan.errors).toEqual([]);
    expect(plan.found).toEqual({
      expenses: true,
      events: true,
      prepaid: true,
      giveaways: true,
    });
    expect(plan.expenses).toMatchObject([
      {
        spentOn: "2026-03-05",
        categoryId: FOLDER,
        vendor: "Print Co",
        eventId: FAIR,
        paymentMethod: "cash",
        amount: 120,
        amountRm: 120,
      },
    ]);
    expect(plan.prepaid).toMatchObject([
      { kind: "top_up", amountRm: 1000, marketingFoc: false },
      {
        kind: "deduction",
        amountRm: 250,
        marketingFoc: true,
        description: "Acme - Lobby",
      },
    ]);
    expect(plan.giveaways).toMatchObject([
      { item: "Catalogue", qty: 3, unitCost: 12.5 },
    ]);
    expect(plan.costs).toMatchObject([
      {
        eventId: FAIR,
        costGroup: "Booth",
        rate: 1500,
        qty: 2,
        foreignAmount: "RMB 2700",
      },
    ]);
    // The demo's sheet has no details block, so the existing event is left as it is.
    expect(plan.events).toEqual([]);
  });

  it("reads dd/mm/yyyy, ISO text, Excel serial and real Excel dates", async () => {
    const line = (date: string | number | Date): Row => [
      date,
      "Folder",
      null,
      "Item",
      "Print Co",
      null,
      "RM",
      10,
      10,
      null,
      null,
    ];
    const file = await workbookWith({
      Log: [
        EXPENSE_HEAD,
        line("31/01/2026"),
        line("2026-02-01"),
        line(serial(2026, 3, 2)),
        line(new Date(Date.UTC(2026, 3, 3))),
      ],
    });

    const plan = await parseMarketingWorkbook(file, known, nextId);

    expect(plan.errors).toEqual([]);
    expect(plan.expenses.map((e) => e.spentOn)).toEqual([
      "2026-01-31",
      "2026-02-01",
      "2026-03-02",
      "2026-04-03",
    ]);
  });

  it("skips Total rows, empty rows and rows with no date and no amount", async () => {
    const file = await workbookWith({
      Log: [
        EXPENSE_HEAD,
        [
          "2026-01-05",
          "Folder",
          null,
          "Item",
          "Print Co",
          null,
          "RM",
          10,
          10,
          null,
          null,
        ],
        ["Total", null, null, null, null, null, null, 10, 10, null, null],
        [
          null,
          null,
          null,
          "Just a note",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        [],
      ],
    });

    const plan = await parseMarketingWorkbook(file, known, nextId);

    expect(plan.errors).toEqual([]);
    expect(plan.expenses).toHaveLength(1);
  });

  it("adds categories and events the file names that the app lacks", async () => {
    const file = await workbookWith({
      Log: [
        EXPENSE_HEAD,
        [
          "2026-01-05",
          "folder",
          "autumn fair",
          "Item",
          "Print Co",
          null,
          "RM",
          10,
          10,
          null,
          null,
        ],
        [
          "2026-01-06",
          "Banners",
          "Autumn Fair",
          "Item",
          "Print Co",
          null,
          "RM",
          10,
          10,
          null,
          null,
        ],
      ],
    });

    const plan = await parseMarketingWorkbook(file, known, nextId);

    expect(plan.newCategories).toHaveLength(1);
    expect(plan.newCategories[0]?.name).toBe("Banners");
    expect(plan.events).toHaveLength(1);
    expect(plan.events[0]).toMatchObject({ name: "autumn fair", isNew: true });
    expect(plan.expenses[0]?.categoryId).toBe(FOLDER);
    expect(plan.expenses[0]?.eventId).toBe(plan.events[0]?.id);
    expect(plan.expenses[1]?.eventId).toBe(plan.events[0]?.id);
  });

  it("reports a bad row with its sheet and row number, using the form's message", async () => {
    const file = await workbookWith({
      Log: [
        EXPENSE_HEAD,
        [
          "2026-01-05",
          "Folder",
          null,
          "Item",
          "Print Co",
          null,
          "RM",
          10,
          10,
          null,
          null,
        ],
        [
          "not a date",
          "Folder",
          null,
          "Item",
          "Print Co",
          null,
          "RM",
          10,
          10,
          null,
          null,
        ],
        [
          "2026-01-07",
          "Folder",
          null,
          "Item",
          "Print Co",
          null,
          "USD",
          10,
          null,
          null,
          null,
        ],
      ],
    });

    const plan = await parseMarketingWorkbook(file, known, nextId);

    expect(plan.errors).toEqual([
      {
        sheet: "Log",
        row: 3,
        message: "Fill in date, description, vendor and amount.",
      },
      { sheet: "Log", row: 4, message: "Key in the amount in RM." },
    ]);
  });

  it("finds no sheets in a workbook of something else", async () => {
    const plan = await parseMarketingWorkbook(
      await workbookWith({ Notes: [["Hello"], ["World"]] }),
      known,
      nextId,
    );
    expect(plan.found).toEqual({
      expenses: false,
      events: false,
      prepaid: false,
      giveaways: false,
    });
  });
});

describe("exporting and importing back", () => {
  const data: MarketingExport = {
    today: "2026-11-18",
    categories: [
      { id: FOLDER, name: "Folder", used: 1 },
      { id: OTHERS, name: "Others", used: 0 },
    ],
    expenses: [
      {
        id: "1",
        spentOn: "2026-03-05",
        categoryId: FOLDER,
        description: "Folders",
        vendorName: "Print Co",
        invoiceRef: "INV-1",
        currency: "RMB",
        amount: 700,
        amountRm: 450.5,
        eventId: FAIR,
        eventName: "A long event name that Excel would cut",
        paymentMethod: "company_card",
        remarks: "Rush",
        createdAt: "2026-03-05T01:00:00Z",
      },
    ],
    events: [
      {
        id: FAIR,
        name: "A long event name that Excel would cut",
        startsOn: "2026-03-01",
        endsOn: "2026-03-03",
        venue: "KLCC",
        budget: 5000,
        notes: "Booth 12",
        costs: [
          {
            id: "c1",
            costGroup: "Booth",
            description: "Shell",
            supplierRef: "Expo",
            foreignAmount: "RMB 2700",
            rate: 1500,
            unit: "ls",
            qty: 2,
            total: 3000,
            remarks: null,
          },
        ],
      },
      {
        id: "e2",
        name: "Empty event",
        startsOn: null,
        endsOn: null,
        venue: null,
        budget: null,
        notes: null,
        costs: [],
      },
    ],
    vendors: [],
    prepaid: [
      {
        id: "p1",
        entryOn: "2026-03-07",
        vendorId: "v1",
        vendorName: "Print Co",
        kind: "deduction",
        description: "Acme - Lobby",
        foreignCurrency: "EUR",
        foreignAmount: 120,
        amountRm: 600,
        mofRef: "MOF-9",
        marketingFoc: true,
        remarks: null,
        createdAt: "2026-03-07T01:00:00Z",
      },
    ],
    giveaways: [
      {
        id: "g1",
        givenOn: "2026-03-08",
        supplier: "Mill",
        invoiceNo: null,
        item: "Catalogue",
        givenTo: "Acme",
        qty: 3,
        unitCost: 12.5,
        total: 37.5,
      },
    ],
  };

  it("brings back every record, event details and category included", async () => {
    const file = await buildMarketingWorkbook(data);
    // Importing into an empty app: nothing is known yet.
    const plan = await parseMarketingWorkbook(
      file,
      { categories: [], events: [] },
      nextId,
    );

    expect(plan.errors).toEqual([]);
    expect(plan.newCategories.map((c) => c.name)).toEqual(["Folder", "Others"]);
    expect(plan.events.map((e) => [e.name, e.details])).toEqual([
      [
        "A long event name that Excel would cut",
        {
          startsOn: "2026-03-01",
          endsOn: "2026-03-03",
          venue: "KLCC",
          budget: 5000,
          notes: "Booth 12",
        },
      ],
      [
        "Empty event",
        {
          startsOn: null,
          endsOn: null,
          venue: null,
          budget: null,
          notes: null,
        },
      ],
    ]);
    const fair = plan.events[0];
    expect(plan.costs).toEqual([
      {
        id: null,
        eventId: fair?.id,
        costGroup: "Booth",
        description: "Shell",
        supplierRef: "Expo",
        foreignAmount: "RMB 2700",
        rate: 1500,
        unit: "ls",
        qty: 2,
        remarks: null,
      },
    ]);
    expect(plan.expenses).toEqual([
      {
        id: null,
        spentOn: "2026-03-05",
        categoryId: plan.newCategories[0]?.id,
        description: "Folders",
        vendor: "Print Co",
        invoiceRef: "INV-1",
        currency: "RMB",
        amount: 700,
        amountRm: 450.5,
        eventId: fair?.id,
        paymentMethod: "company_card",
        remarks: "Rush",
      },
    ]);
    expect(plan.prepaid).toEqual([
      {
        id: null,
        kind: "deduction",
        entryOn: "2026-03-07",
        vendor: "Print Co",
        description: "Acme - Lobby",
        foreignCurrency: "EUR",
        foreignAmount: 120,
        amountRm: 600,
        mofRef: "MOF-9",
        marketingFoc: true,
        remarks: null,
      },
    ]);
    expect(plan.giveaways).toEqual([
      {
        id: null,
        givenOn: "2026-03-08",
        supplier: "Mill",
        invoiceNo: null,
        item: "Catalogue",
        givenTo: "Acme",
        qty: 3,
        unitCost: 12.5,
      },
    ]);
  });

  it("keeps event sheet names valid and apart when two events share a short name", async () => {
    const twin = (id: string, name: string) => ({
      ...data.events[1],
      id,
      name,
    });
    const file = await buildMarketingWorkbook({
      ...data,
      expenses: [],
      events: [
        twin("t1", "Expo: [2026] / Kuala Lumpur International Hall A"),
        twin("t2", "Expo: [2026] / Kuala Lumpur International Hall B"),
        twin("t3", "Expense Log"),
      ],
    });
    const workbook = new Workbook();
    await workbook.xlsx.load(file);
    const names = workbook.worksheets.map((sheet) => sheet.name);

    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    expect(names.every((n) => n.length <= 31 && !/[\\/?*[\]:]/.test(n))).toBe(
      true,
    );

    const plan = await parseMarketingWorkbook(
      file,
      { categories: [], events: [] },
      nextId,
    );
    expect(plan.events.map((e) => e.name)).toEqual([
      "Expo: [2026] / Kuala Lumpur International Hall A",
      "Expo: [2026] / Kuala Lumpur International Hall B",
      "Expense Log",
    ]);
  });
});
