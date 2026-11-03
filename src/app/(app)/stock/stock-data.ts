import { z } from "zod";
import {
  RESERVATION_STATUSES,
  type ReservationStatus,
  STOCK_UNITS,
  type StockUnit,
} from "@/lib/domain/reservation";
import { createClient } from "@/lib/supabase/server";

export type StockItem = {
  id: string;
  sku: string;
  supplier: string;
  collection: string;
  qty: number;
  unit: StockUnit;
};

export type Reservation = {
  id: string;
  itemId: string;
  sku: string;
  supplier: string;
  collection: string;
  unit: StockUnit;
  qty: number;
  projectId: string;
  projectName: string;
  companyName: string;
  mofNo: string | null;
  reservedBy: string;
  status: ReservationStatus;
  reservedAt: string | null;
  expiresOn: string | null;
  note: string;
  createdAt: string;
};

const itemRows = z.array(
  z.object({
    id: z.string(),
    sku: z.string(),
    supplier: z.string(),
    collection: z.string().nullable(),
    qty: z.number(),
    unit: z.enum(STOCK_UNITS),
  }),
);

/** Every stock item, by SKU. */
export async function loadStockItems(): Promise<StockItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_items")
    .select("id, sku, supplier, collection, qty, unit")
    .order("sku");
  if (error) throw new Error(`Could not load stock: ${error.message}`);
  return itemRows.parse(data).map((row) => ({
    ...row,
    collection: row.collection ?? "",
  }));
}

const reservationRows = z.array(
  z.object({
    id: z.string(),
    item_id: z.string(),
    qty: z.number(),
    project_id: z.string(),
    reserved_by: z.string(),
    status: z.enum(RESERVATION_STATUSES),
    reserved_at: z.string().nullable(),
    expires_on: z.string().nullable(),
    note: z.string().nullable(),
    created_at: z.string(),
    stock_items: z.object({
      sku: z.string(),
      supplier: z.string(),
      collection: z.string().nullable(),
      unit: z.enum(STOCK_UNITS),
    }),
    // Null for a salesperson when the project is someone else's: they read only their own.
    projects: z
      .object({
        name: z.string(),
        mofs: z.object({ mof_no: z.string() }).nullable(),
        contacts: z.object({ companies: z.object({ name: z.string() }) }),
      })
      .nullable(),
  }),
);

/** Every reservation line, newest first. Released and cancelled lines stay as history. */
export async function loadReservations(): Promise<Reservation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_reservations")
    .select(
      "id, item_id, qty, project_id, reserved_by, status, reserved_at, expires_on, note, created_at, stock_items(sku, supplier, collection, unit), projects(name, mofs(mof_no), contacts(companies(name)))",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load reservations: ${error.message}`);
  return reservationRows.parse(data).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    sku: row.stock_items.sku,
    supplier: row.stock_items.supplier,
    collection: row.stock_items.collection ?? "",
    unit: row.stock_items.unit,
    qty: row.qty,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "Another salesperson's project",
    companyName: row.projects?.contacts.companies.name ?? "",
    mofNo: row.projects?.mofs?.mof_no ?? null,
    reservedBy: row.reserved_by,
    status: row.status,
    reservedAt: row.reserved_at,
    expiresOn: row.expires_on,
    note: row.note ?? "",
    createdAt: row.created_at,
  }));
}

const projectRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

export type ReservableProject = { id: string; label: string };

/** Projects stock can be held for: the person's own, or every live one for those who arrange stock. */
export async function loadReservableProjects(
  meId: string,
  arrangesStock: boolean,
): Promise<ReservableProject[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, name, contacts(companies(name))")
    .neq("stage", "lost")
    .order("name");
  if (!arrangesStock) {
    query = query.or(`pic_id.eq.${meId},support_id.eq.${meId}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return projectRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.name} · ${row.contacts.companies.name}`,
  }));
}
