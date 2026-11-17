// The sheets and column headings of the marketing workbook (demo 2.8). Export writes them and import
// finds them by the same words, so the two cannot drift apart.
export const SHEET = {
  expenses: "Expense Log",
  vendors: "Vendors",
  prepaid: "Prepaid & Deposits",
  giveaways: "Sample Give-away",
  categories: "Categories",
} as const;

export const EXPENSE_HEADERS = {
  date: "Date",
  category: "Category",
  event: "Campaign / event",
  description: "Description",
  vendor: "Vendor",
  invoiceRef: "Invoice / ref no.",
  currency: "Currency",
  amount: "Amount",
  amountRm: "Amount (RM)",
  paymentMethod: "Payment method",
  remarks: "Remarks",
  // Written by export for reading in Excel; import works the month out from the date.
  month: "Month",
} as const;

export const PREPAID_HEADERS = {
  date: "Date",
  vendor: "Vendor",
  description: "Description / project",
  mofRef: "Ref / MOF",
  topUp: "Top-up (RM)",
  used: "Used (RM)",
  marketingFoc: "Marketing?",
  remarks: "Remarks",
  // Not in the demo's file: kept so a round trip does not lose the foreign amount.
  foreignCurrency: "Foreign currency",
  foreignAmount: "Foreign amount",
} as const;

export const GIVEAWAY_HEADERS = {
  date: "Date",
  supplier: "Supplier",
  invoiceNo: "Invoice no.",
  item: "Item",
  givenTo: "Given to (client / project)",
  qty: "Qty",
  unitCost: "Unit cost",
  total: "Total (RM)",
} as const;

export const EVENT_COST_HEADERS = {
  costGroup: "Cost group",
  description: "Description",
  supplierRef: "Supplier / ref",
  foreignAmount: "Foreign amount",
  rate: "Rate (RM)",
  unit: "Unit",
  qty: "Qty",
  total: "Total (RM)",
  remarks: "Remarks",
} as const;

// The lines above an event sheet's cost table: the demo has none, so its sheets still import.
export const EVENT_META_LABELS = {
  name: "Event",
  venue: "Venue",
  startsOn: "Starts",
  endsOn: "Ends",
  budget: "Budget (RM)",
  notes: "Notes",
} as const;

export const CATEGORY_HEADER = "Category";

export const VENDOR_HEADERS = [
  "Vendor",
  "Type",
  "Skills",
  "Rate",
  "Portfolio",
  "Supplies",
  "Contact",
  "Phone",
  "Email",
  "Notes",
  "Vendor total YTD",
] as const;

export const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Next.js refuses larger posts to a server action (1 MB by default). */
export const MAX_IMPORT_BYTES = 1_000_000;
