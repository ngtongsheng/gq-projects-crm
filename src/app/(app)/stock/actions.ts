"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canChangeSettings,
  canEditStock,
  canRequestStock,
} from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  canExtendHold,
  canMoveReservation,
  extendedUntil,
  holdUntil,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from "@/lib/domain/reservation";
import { optionalText, textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { positiveQuantity } from "./quantity-fields";
import { stockItemSchema } from "./stock-item-schema";
import { loadStockSettings } from "./stock-settings";

export type StockResult = { error: string | null };

const NOT_STOCK =
  "Only the people who arrange stock can change stock and reservations.";
const NOT_REQUESTER =
  "Only salespeople and the people who arrange stock can reserve stock.";
const NOT_FOUND_ITEM = "Could not find that stock item. Reload the page.";
const NOT_FOUND_PROJECT = "Could not find that project. Reload the page.";
const NOT_FOUND_RESERVATION =
  "Could not find that reservation. Reload the page.";
const CHANGED = "Someone changed this reservation first. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

/** The database message for a hold that takes more than is left; it is already plain words. */
const tooMuch = (error: { code?: string; message?: string }) =>
  error.code === "23514" &&
  /^Only .* left of this stock\.$/.test(error.message ?? "")
    ? (error.message ?? null)
    : null;

const reserveForm = z.object({
  itemId: z.uuid({ error: NOT_FOUND_ITEM }),
  projectId: z.uuid({ error: NOT_FOUND_PROJECT }),
  qty: positiveQuantity,
  reservedBy: z.union([z.literal(""), z.uuid()]),
  note: optionalText(300, "Keep the note under 300 characters."),
});

/**
 * A salesperson asks for a hold and waits for confirmation. Someone who arranges stock records
 * it straight away, for themselves or on behalf of a salesperson. The database checks both.
 */
export async function reserveStock(formData: FormData): Promise<StockResult> {
  const me = await requirePage("stock");
  const arranges = canEditStock(me);
  if (!canRequestStock(me)) {
    return { error: NOT_REQUESTER };
  }

  const parsed = reserveForm.safeParse({
    itemId: textField(formData, "itemId"),
    projectId: textField(formData, "projectId"),
    qty: textField(formData, "qty"),
    reservedBy: textField(formData, "reservedBy"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const line = parsed.data;

  let hold: {
    status: "reserved";
    reserved_at: string;
    expires_on: string;
  } | null = null;
  if (arranges) {
    const today = todayMyt();
    const { holdDays } = await loadStockSettings();
    hold = {
      status: "reserved",
      reserved_at: today,
      expires_on: holdUntil(today, holdDays),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_reservations").insert({
    item_id: line.itemId,
    project_id: line.projectId,
    qty: line.qty,
    reserved_by: arranges && line.reservedBy ? line.reservedBy : me.id,
    note: line.note,
    status: "requested",
    ...hold,
  });
  if (error) {
    const message = tooMuch(error);
    if (message) return { error: message };
    if (error.code === "42501") {
      return {
        error: arranges
          ? NOT_STOCK
          : "You can only reserve stock for a project you own or support.",
      };
    }
    if (error.code === "23503") return { error: NOT_FOUND_ITEM };
    console.error("Could not reserve the stock", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/stock");
  return { error: null };
}

const moveForm = z.object({
  reservationId: z.uuid({ error: NOT_FOUND_RESERVATION }),
  to: z.enum(RESERVATION_STATUSES),
});

const currentLine = z.array(
  z.object({
    status: z.enum(RESERVATION_STATUSES),
    expires_on: z.string().nullable(),
  }),
);

async function loadLine(reservationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_reservations")
    .select("status, expires_on")
    .eq("id", reservationId);
  if (error) {
    console.error("Could not read the reservation", error);
    return { line: null, error: TRY_AGAIN };
  }
  const line = currentLine.parse(data)[0];
  return line
    ? { line, error: null }
    : { line: null, error: NOT_FOUND_RESERVATION };
}

/** Moves a line along: confirm a request, issue the PO, mark delivered, release or cancel. */
export async function moveReservation(
  formData: FormData,
): Promise<StockResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = moveForm.safeParse({
    reservationId: textField(formData, "reservationId"),
    to: textField(formData, "to"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { reservationId, to } = parsed.data;

  const current = await loadLine(reservationId);
  if (!current.line) return { error: current.error };
  const from: ReservationStatus = current.line.status;
  if (!canMoveReservation(from, to)) return { error: CHANGED };

  // Confirming starts the hold clock.
  let patch: Record<string, string> = { status: to };
  if (to === "reserved") {
    const today = todayMyt();
    const { holdDays } = await loadStockSettings();
    patch = {
      status: to,
      reserved_at: today,
      expires_on: holdUntil(today, holdDays),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_reservations")
    .update(patch)
    .eq("id", reservationId)
    .eq("status", from)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_STOCK };
    console.error("Could not update the reservation", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: CHANGED };

  revalidatePath("/stock");
  return { error: null };
}

const extendForm = z.object({
  reservationId: z.uuid({ error: NOT_FOUND_RESERVATION }),
});

/** Adds the hold days again; a hold that already lapsed restarts from today. */
export async function extendReservation(
  formData: FormData,
): Promise<StockResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = extendForm.safeParse({
    reservationId: textField(formData, "reservationId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { reservationId } = parsed.data;

  const current = await loadLine(reservationId);
  if (!current.line) return { error: current.error };
  const { status, expires_on: expiresOn } = current.line;
  if (!canExtendHold(status) || !expiresOn) return { error: CHANGED };

  const { holdDays } = await loadStockSettings();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_reservations")
    .update({ expires_on: extendedUntil(expiresOn, todayMyt(), holdDays) })
    .eq("id", reservationId)
    .eq("status", status)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_STOCK };
    console.error("Could not extend the reservation", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: CHANGED };

  revalidatePath("/stock");
  return { error: null };
}

const itemForm = stockItemSchema.extend({
  itemId: z.union([z.literal(""), z.uuid({ error: NOT_FOUND_ITEM })]),
});

/** Adds a stock item, or changes one when `itemId` is given (the unit stays as first entered). */
export async function saveStockItem(formData: FormData): Promise<StockResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = itemForm.safeParse({
    itemId: textField(formData, "itemId"),
    sku: textField(formData, "sku"),
    supplier: textField(formData, "supplier"),
    collection: textField(formData, "collection"),
    qty: textField(formData, "qty"),
    unit: textField(formData, "unit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { itemId, unit, ...item } = parsed.data;

  const supabase = await createClient();
  const { data, error } = itemId
    ? await supabase
        .from("stock_items")
        .update(item)
        .eq("id", itemId)
        .select("id")
    : await supabase
        .from("stock_items")
        .insert({ ...item, unit })
        .select("id");
  if (error) {
    if (error.code === "23505")
      return { error: "That SKU is already in stock." };
    if (error.code === "42501") return { error: NOT_STOCK };
    console.error("Could not save the stock item", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_ITEM };

  revalidatePath("/stock");
  return { error: null };
}

const settingsForm = z.object({
  holdDays: z.coerce
    .number({ error: "Enter the hold days." })
    .int("Hold days must be a whole number.")
    .min(1, "A hold must run at least 1 day.")
    .max(365, "Keep the hold under a year."),
  warningDays: z.coerce
    .number({ error: "Enter the warning days." })
    .int("Warning days must be a whole number.")
    .min(0, "Warning days cannot be negative.")
    .max(365, "Keep the warning under a year."),
});

/** The hold length and warning, for the MD and admins; the database holds that line too. */
export async function saveStockSettings(
  formData: FormData,
): Promise<StockResult> {
  const me = await requirePage("stock");
  if (!canChangeSettings(me)) {
    return { error: "Only the MD or an admin can change these settings." };
  }

  const parsed = settingsForm.safeParse({
    holdDays: textField(formData, "holdDays"),
    warningDays: textField(formData, "warningDays"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert(
    [
      { key: "stock_hold_days", value: parsed.data.holdDays },
      { key: "stock_warning_days", value: parsed.data.warningDays },
    ],
    { onConflict: "key" },
  );
  if (error) {
    if (error.code === "42501") {
      return { error: "Only the MD or an admin can change these settings." };
    }
    console.error("Could not save the stock settings", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/stock");
  return { error: null };
}
