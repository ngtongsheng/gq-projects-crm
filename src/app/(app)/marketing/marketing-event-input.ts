import { z } from "zod";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";

const EVENT_NOT_FOUND = "Could not find that event. Reload the page.";
const COST_NOT_FOUND = "Could not find that cost line. Reload the page.";
const COST_REQUIRED = "Choose the event and fill in cost group and rate.";
// numeric(12,2) holds up to this.
const MAX_AMOUNT = 9_999_999_999.99;

const optionalDate = z
  .union([z.literal(""), z.iso.date("Check the date.")])
  .transform((value) => (value === "" ? null : value));

const optionalAmount = (message: string) =>
  z
    .string()
    .trim()
    .transform((text, ctx) => {
      if (text === "") return null;
      const amount = parseRm(text);
      if (amount === null || amount < 0 || amount > MAX_AMOUNT) {
        ctx.issues.push({ code: "custom", message, input: text });
        return z.NEVER;
      }
      return amount;
    });

/** Add or edit an event (demo sheetMkEvent). A budget of 0 is the same as none. */
export const eventSchema = z
  .object({
    // Blank when adding.
    id: optionalId(EVENT_NOT_FOUND),
    name: z
      .string()
      .trim()
      .min(1, "Fill in the event name.")
      .max(200, "Keep the name under 200 characters."),
    startsOn: optionalDate,
    endsOn: optionalDate,
    venue: optionalText(200, "Keep the venue under 200 characters."),
    budget: optionalAmount("The budget must be an amount in RM."),
    notes: optionalText(1000, "Keep the notes under 1000 characters."),
  })
  .refine(
    (form) =>
      form.startsOn === null ||
      form.endsOn === null ||
      form.endsOn >= form.startsOn,
    { message: "The end date is before the start date.", path: ["endsOn"] },
  )
  .transform((form) => ({
    ...form,
    budget: form.budget === 0 ? null : form.budget,
  }));
export type EventInput = z.output<typeof eventSchema>;

export const eventId = z.uuid({ error: EVENT_NOT_FOUND });

/** Add or edit a line of an event's cost sheet (demo sheetMkEvt). The total is worked out by the database. */
export const eventCostSchema = z.object({
  // Blank when adding.
  id: optionalId(COST_NOT_FOUND),
  eventId: z.uuid(COST_REQUIRED),
  costGroup: z
    .string()
    .trim()
    .min(1, COST_REQUIRED)
    .max(100, "Keep the cost group under 100 characters."),
  description: optionalText(300, "Keep the description under 300 characters."),
  supplierRef: optionalText(200, "Keep the supplier under 200 characters."),
  foreignAmount: optionalText(
    100,
    "Keep the foreign amount under 100 characters.",
  ),
  rate: z
    .string()
    .transform((text) => parseRm(text))
    .pipe(
      z
        .number({ error: COST_REQUIRED })
        .min(-MAX_AMOUNT, "That rate is too large.")
        .max(MAX_AMOUNT, "That rate is too large."),
    ),
  unit: z
    .string()
    .trim()
    .max(20, "Keep the unit under 20 characters.")
    .transform((unit) => (unit === "" ? "ls" : unit)),
  qty: z
    .string()
    .trim()
    .transform((text) => (text === "" ? 1 : parseRm(text)))
    .pipe(
      z
        .number({ error: "The quantity must be more than 0." })
        .positive("The quantity must be more than 0.")
        .max(MAX_AMOUNT, "That quantity is too large."),
    ),
  remarks: optionalText(1000, "Keep the remarks under 1000 characters."),
});
export type EventCostInput = z.output<typeof eventCostSchema>;

export const eventCostId = z.uuid({ error: COST_NOT_FOUND });
