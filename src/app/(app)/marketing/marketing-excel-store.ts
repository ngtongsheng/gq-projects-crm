import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import type { ImportPlan } from "./marketing-excel-import";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Table =
  | "marketing_expenses"
  | "marketing_event_costs"
  | "marketing_prepaid_entries"
  | "marketing_giveaways";
type DatabaseError = { code?: string; message?: string };

const INSERT_CHUNK = 200;
// Ids go in the address of the delete request, which has a length limit.
const DELETE_CHUNK = 100;
// The most rows the database hands back in one read.
const PAGE = 1000;

/** A failed database call, kept whole so the caller can read its code. */
class StoreError extends Error {
  constructor(readonly detail: DatabaseError) {
    super(detail.message ?? "Database call failed");
  }
}

function must<T>(result: { data: T; error: DatabaseError | null }): T {
  if (result.error) throw new StoreError(result.error);
  return result.data;
}

const idRows = z.array(z.object({ id: z.uuid() }));

async function allIds(supabase: Supabase, table: Table): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = idRows.parse(
      must(
        await supabase
          .from(table)
          .select("id")
          .order("id")
          .range(from, from + PAGE - 1),
      ),
    );
    ids.push(...rows.map((row) => row.id));
    if (rows.length < PAGE) return ids;
  }
}

async function deleteIds(supabase: Supabase, table: Table, ids: string[]) {
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    must(
      await supabase
        .from(table)
        .delete()
        .in("id", ids.slice(i, i + DELETE_CHUNK))
        .select("id"),
    );
  }
}

/** Vendor ids by lower-case name, adding the names the file uses that the app does not have yet. */
async function vendorIds(supabase: Supabase, names: readonly string[]) {
  const rows = z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .parse(must(await supabase.from("marketing_vendors").select("id, name")));
  const ids = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
  const added: { id: string; name: string }[] = [];
  for (const name of names) {
    if (ids.has(name.toLowerCase())) continue;
    const id = crypto.randomUUID();
    ids.set(name.toLowerCase(), id);
    added.push({ id, name });
  }
  if (added.length > 0)
    must(await supabase.from("marketing_vendors").insert(added));
  return ids;
}

async function addCategories(supabase: Supabase, plan: ImportPlan) {
  if (plan.newCategories.length === 0) return;
  const last = z
    .array(z.object({ sort_order: z.number() }))
    .parse(
      must(
        await supabase
          .from("marketing_categories")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1),
      ),
    );
  const start = (last[0]?.sort_order ?? 0) + 1;
  must(
    await supabase.from("marketing_categories").insert(
      plan.newCategories.map((category, index) => ({
        ...category,
        sort_order: start + index,
      })),
    ),
  );
}

async function saveEvents(supabase: Supabase, plan: ImportPlan) {
  const fields = (
    details: NonNullable<ImportPlan["events"][number]["details"]>,
  ) => ({
    starts_on: details.startsOn,
    ends_on: details.endsOn,
    venue: details.venue,
    budget: details.budget,
    notes: details.notes,
  });
  const added = plan.events
    .filter((event) => event.isNew)
    .map((event) => ({
      id: event.id,
      name: event.name,
      ...(event.details ? fields(event.details) : {}),
    }));
  if (added.length > 0)
    must(await supabase.from("marketing_events").insert(added));
  for (const event of plan.events) {
    if (event.isNew || !event.details) continue;
    must(
      await supabase
        .from("marketing_events")
        .update(fields(event.details))
        .eq("id", event.id)
        .select("id"),
    );
  }
}

/**
 * Writes a checked plan. Replace mode adds the new lines first and removes the old ones only after
 * every insert worked, so a failure part-way leaves the old data in place (the new lines are taken
 * out again). It replaces only the kinds of sheet the file has. Returns the database error, if any.
 */
export async function applyMarketingImport(
  supabase: Supabase,
  plan: ImportPlan,
  replace: boolean,
): Promise<{ error: DatabaseError | null }> {
  const inserted: { table: Table; ids: string[] }[] = [];
  const insertRows = async (table: Table, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK).map((row) => ({
        id: crypto.randomUUID(),
        ...row,
      }));
      must(await supabase.from(table).insert(chunk));
      inserted.push({ table, ids: chunk.map((row) => row.id) });
    }
  };

  try {
    const old: { table: Table; ids: string[] }[] = [];
    if (replace) {
      const clear: [boolean, Table][] = [
        [plan.found.expenses, "marketing_expenses"],
        [plan.found.events, "marketing_event_costs"],
        [plan.found.prepaid, "marketing_prepaid_entries"],
        [plan.found.giveaways, "marketing_giveaways"],
      ];
      for (const [wanted, table] of clear) {
        if (wanted) old.push({ table, ids: await allIds(supabase, table) });
      }
    }

    await addCategories(supabase, plan);
    const vendors = await vendorIds(supabase, [
      ...new Set([
        ...plan.expenses.map((e) => e.vendor),
        ...plan.prepaid.map((e) => e.vendor),
      ]),
    ]);
    const vendorOf = (name: string) => vendors.get(name.toLowerCase());
    await saveEvents(supabase, plan);

    await insertRows(
      "marketing_event_costs",
      plan.costs.map((c) => ({
        event_id: c.eventId,
        cost_group: c.costGroup,
        description: c.description,
        supplier_ref: c.supplierRef,
        foreign_amount: c.foreignAmount,
        rate: c.rate,
        unit: c.unit,
        qty: c.qty,
        remarks: c.remarks,
      })),
    );
    await insertRows(
      "marketing_expenses",
      plan.expenses.map((e) => ({
        spent_on: e.spentOn,
        category_id: e.categoryId,
        description: e.description,
        vendor_id: vendorOf(e.vendor),
        invoice_ref: e.invoiceRef,
        currency: e.currency,
        amount: e.amount,
        amount_rm: e.amountRm,
        event_id: e.eventId,
        payment_method: e.paymentMethod,
        remarks: e.remarks,
      })),
    );
    await insertRows(
      "marketing_prepaid_entries",
      plan.prepaid.map((p) => ({
        entry_on: p.entryOn,
        vendor_id: vendorOf(p.vendor),
        kind: p.kind,
        description: p.description,
        foreign_currency: p.foreignCurrency,
        foreign_amount: p.foreignAmount,
        amount_rm: p.amountRm,
        mof_ref: p.mofRef,
        marketing_foc: p.marketingFoc,
        remarks: p.remarks,
      })),
    );
    await insertRows(
      "marketing_giveaways",
      plan.giveaways.map((g) => ({
        given_on: g.givenOn,
        supplier: g.supplier,
        invoice_no: g.invoiceNo,
        item: g.item,
        given_to: g.givenTo,
        qty: g.qty,
        unit_cost: g.unitCost,
      })),
    );

    // Everything is in: from here a failure keeps the new lines, so nothing is lost either way.
    inserted.length = 0;
    for (const { table, ids } of old) await deleteIds(supabase, table, ids);
    return { error: null };
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
    // Best effort: the original error is the one to report, so a failed clean-up is not.
    for (const { table, ids } of inserted.reverse()) {
      await deleteIds(supabase, table, ids).catch(() => undefined);
    }
    return { error: error.detail };
  }
}
