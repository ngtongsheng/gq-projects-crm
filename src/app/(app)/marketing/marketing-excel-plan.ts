import type { EventCostInput, EventInput } from "./marketing-event-input";
import type { GiveawayInput } from "./marketing-giveaway-input";
import type { ExpenseInput } from "./marketing-input";
import type { PrepaidEntryInput } from "./marketing-prepaid-input";

export type KnownRecords = {
  categories: readonly { id: string; name: string }[];
  events: readonly { id: string; name: string }[];
};

type EventDetails = Pick<
  EventInput,
  "startsOn" | "endsOn" | "venue" | "budget" | "notes"
>;

/** An event the file names: one already in the app, or one to add. `details` is set when the file has the event's own sheet block. */
export type PlannedEvent = {
  id: string;
  name: string;
  isNew: boolean;
  details: EventDetails | null;
};

/** What reading the file found, validated like the forms. Nothing is saved until `errors` is empty. */
export type ImportPlan = {
  newCategories: { id: string; name: string }[];
  /** Only events to add or to change; ones the file merely mentions are left out. */
  events: PlannedEvent[];
  costs: EventCostInput[];
  expenses: ExpenseInput[];
  prepaid: PrepaidEntryInput[];
  giveaways: GiveawayInput[];
  /** Which kinds of sheet the file has, so a replace only clears what the file brings back. */
  found: {
    expenses: boolean;
    events: boolean;
    prepaid: boolean;
    giveaways: boolean;
  };
  errors: ImportProblem[];
};

/** A row (or a whole sheet, when `row` is null) that cannot be imported, with the form's own message. */
export type ImportProblem = {
  sheet: string;
  row: number | null;
  message: string;
};

/** The plan being built while sheets are read, with the lookups every sheet reader shares. */
export type ImportContext = {
  plan: ImportPlan;
  events: Map<string, PlannedEvent>;
  categoryId: (name: string) => string;
  eventFor: (name: string) => PlannedEvent;
  report: (sheet: string, row: number | null, message: string) => void;
};

export function createImportContext(
  known: KnownRecords,
  newId: () => string,
): ImportContext {
  const plan: ImportPlan = {
    newCategories: [],
    events: [],
    costs: [],
    expenses: [],
    prepaid: [],
    giveaways: [],
    found: { expenses: false, events: false, prepaid: false, giveaways: false },
    errors: [],
  };

  const categoryIds = new Map(
    known.categories.map((c) => [c.name.toLowerCase(), c.id]),
  );
  const categoryId = (name: string) => {
    const key = name.toLowerCase();
    const found = categoryIds.get(key);
    if (found) return found;
    const id = newId();
    categoryIds.set(key, id);
    plan.newCategories.push({ id, name });
    return id;
  };

  const events = new Map<string, PlannedEvent>(
    known.events.map((e) => [
      e.name.toLowerCase(),
      { id: e.id, name: e.name, isNew: false, details: null },
    ]),
  );
  const eventFor = (name: string): PlannedEvent => {
    const key = name.toLowerCase();
    const found = events.get(key);
    if (found) return found;
    const added: PlannedEvent = {
      id: newId(),
      name,
      isNew: true,
      details: null,
    };
    events.set(key, added);
    return added;
  };

  const report = (sheet: string, row: number | null, message: string) =>
    plan.errors.push({ sheet, row, message });

  return { plan, events, categoryId, eventFor, report };
}
