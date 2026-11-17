import { sumRm } from "@/lib/format/money";
import type {
  EventCostLine,
  MarketingCategory,
  MarketingEvent,
  MarketingExpense,
} from "./marketing-types";

/**
 * One row of an event's costing: a line of its own cost sheet, or an expense-log line tagged to
 * the event (demo 2.5). A log line is grouped under its category.
 */
export type EventCostItem = {
  /** "sheet": edited as a cost line. "log": edited as an expense. */
  source: "sheet" | "log";
  id: string;
  group: string;
  description: string | null;
  supplierRef: string | null;
  foreignAmount: string | null;
  /** Only a cost-sheet line has a rate, unit and quantity. */
  rate: number | null;
  unit: string | null;
  qty: number | null;
  total: number;
  remarks: string | null;
};

export type EventGroup = {
  group: string;
  total: number;
  /** Share of the event's cost, whole percent. */
  percent: number;
  items: EventCostItem[];
};

export type EventSheet = {
  items: EventCostItem[];
  /** Cost-sheet lines plus expense-log lines tagged to the event. */
  total: number;
  fromLog: number;
  budget: number | null;
  /** Budget minus cost: negative when over; null with no budget. */
  left: number | null;
  over: boolean;
  /** Biggest group first. */
  groups: EventGroup[];
};

export type EventListRow = {
  id: string;
  name: string;
  venue: string | null;
  startsOn: string | null;
  endsOn: string | null;
  items: number;
  budget: number | null;
  cost: number;
  over: boolean;
};

const sheetItem = (line: EventCostLine): EventCostItem => ({
  source: "sheet",
  id: line.id,
  group: line.costGroup,
  description: line.description,
  supplierRef: line.supplierRef,
  foreignAmount: line.foreignAmount,
  rate: line.rate,
  unit: line.unit,
  qty: line.qty,
  total: line.total,
  remarks: line.remarks,
});

const logItem = (
  expense: MarketingExpense,
  categoryName: ReadonlyMap<string, string>,
): EventCostItem => ({
  source: "log",
  id: expense.id,
  group: categoryName.get(expense.categoryId) ?? "",
  description: expense.description,
  supplierRef: [expense.vendorName, expense.invoiceRef]
    .filter(Boolean)
    .join(" · "),
  foreignAmount:
    expense.currency === "RM" ? null : `${expense.currency} ${expense.amount}`,
  rate: null,
  unit: null,
  qty: null,
  total: expense.amountRm,
  remarks: expense.remarks,
});

function itemsOf(
  event: MarketingEvent,
  expenses: readonly MarketingExpense[],
  categoryName: ReadonlyMap<string, string>,
): EventCostItem[] {
  return [
    ...event.costs.map(sheetItem),
    ...expenses
      .filter((expense) => expense.eventId === event.id)
      .map((expense) => logItem(expense, categoryName)),
  ];
}

const isOver = (budget: number | null, cost: number) =>
  budget !== null && cost > budget;

/** An event's whole costing: both kinds of line, the budget against the cost, and the cost groups. */
export function eventSheet(
  event: MarketingEvent,
  expenses: readonly MarketingExpense[],
  categories: readonly Pick<MarketingCategory, "id" | "name">[],
): EventSheet {
  const items = itemsOf(
    event,
    expenses,
    new Map(categories.map((category) => [category.id, category.name])),
  );
  const total = sumRm(items.map((item) => item.total));

  const byGroup = new Map<string, EventCostItem[]>();
  for (const item of items) {
    byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), item]);
  }
  const groups = [...byGroup]
    .map(([group, groupItems]) => {
      const groupTotal = sumRm(groupItems.map((item) => item.total));
      return {
        group,
        total: groupTotal,
        percent: total > 0 ? Math.round((groupTotal / total) * 100) : 0,
        items: groupItems,
      };
    })
    .sort((a, b) => b.total - a.total || a.group.localeCompare(b.group));

  return {
    items,
    total,
    fromLog: items.filter((item) => item.source === "log").length,
    budget: event.budget,
    left: event.budget === null ? null : sumRm([event.budget, -total]),
    over: isOver(event.budget, total),
    groups,
  };
}

/** The "All events" table: each event's item count, budget and cost. */
export function eventListRows(
  events: readonly MarketingEvent[],
  expenses: readonly MarketingExpense[],
  categories: readonly Pick<MarketingCategory, "id" | "name">[],
): EventListRow[] {
  return events.map((event) => {
    const sheet = eventSheet(event, expenses, categories);
    return {
      id: event.id,
      name: event.name,
      venue: event.venue,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      items: sheet.items.length,
      budget: event.budget,
      cost: sheet.total,
      over: sheet.over,
    };
  });
}
