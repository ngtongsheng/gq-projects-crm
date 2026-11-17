"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import {
  eventCostId,
  eventCostSchema,
  eventId,
  eventSchema,
} from "./marketing-event-input";
import { NOT_EDITOR, TRY_AGAIN } from "./marketing-refusal";

export type EventResult = { error: string | null };

const EVENT_NOT_FOUND = "Could not find that event. Reload the page.";
const COST_NOT_FOUND = "Could not find that cost line. Reload the page.";

/** Adds an event, or saves changes to one. A rename shows everywhere at once (linked by id). */
export async function saveMarketingEvent(
  input: unknown,
): Promise<EventResult & { id?: string }> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { id, ...form } = parsed.data;

  const fields = {
    name: form.name,
    starts_on: form.startsOn,
    ends_on: form.endsOn,
    venue: form.venue,
    budget: form.budget,
    notes: form.notes,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("marketing_events")
        .update(fields)
        .eq("id", id)
        .select("id")
    : await supabase.from("marketing_events").insert(fields).select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23505") {
      return { error: "An event with that name already exists." };
    }
    logServerError("Could not save the marketing event", error, {
      profileId: me.id,
      recordId: id ?? undefined,
    });
    return { error: TRY_AGAIN };
  }
  const saved = data[0];
  if (!saved) return { error: EVENT_NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null, id: saved.id };
}

/** Deletes an event nothing refers to; the database refuses while a cost line or an expense does. */
export async function deleteMarketingEvent(id: string): Promise<EventResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = eventId.safeParse(id);
  if (!parsed.success) return { error: EVENT_NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_events")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23503") {
      return {
        error: "This event has cost lines or expenses, so it can't be deleted.",
      };
    }
    logServerError("Could not delete the marketing event", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) return { error: EVENT_NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}

/** Adds a line to an event's cost sheet, or saves changes to one. */
export async function saveMarketingEventCost(
  input: unknown,
): Promise<EventResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = eventCostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { id, ...form } = parsed.data;

  const fields = {
    event_id: form.eventId,
    cost_group: form.costGroup,
    description: form.description,
    supplier_ref: form.supplierRef,
    foreign_amount: form.foreignAmount,
    rate: form.rate,
    unit: form.unit,
    qty: form.qty,
    remarks: form.remarks,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("marketing_event_costs")
        .update(fields)
        .eq("id", id)
        .select("id")
    : await supabase.from("marketing_event_costs").insert(fields).select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23503") return { error: EVENT_NOT_FOUND };
    logServerError("Could not save the event cost line", error, {
      profileId: me.id,
      recordId: id ?? undefined,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: COST_NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}

/** Deletes a line of an event's cost sheet. */
export async function deleteMarketingEventCost(
  id: string,
): Promise<EventResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = eventCostId.safeParse(id);
  if (!parsed.success) return { error: COST_NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_event_costs")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not delete the event cost line", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) return { error: COST_NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}
