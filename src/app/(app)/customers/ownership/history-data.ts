import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type OwnershipChange = {
  id: string;
  /** When it changed. */
  at: string;
  changedBy: string;
  from: string[];
  to: string[];
  reason: string;
  wholeCompany: boolean;
};

const changeRows = z.array(
  z.object({
    id: z.string(),
    created_at: z.string(),
    changed_by: z.string(),
    from_owners: z.array(z.string()),
    to_owners: z.array(z.string()),
    reason: z.string(),
    whole_company: z.boolean(),
  }),
);

/** A customer's ownership changes, newest first, with people's names. Managers only: the database shows nobody else. */
export async function loadOwnershipChanges(
  contactId: string,
  nameOf: ReadonlyMap<string, string>,
): Promise<OwnershipChange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ownership_changes")
    .select(
      "id, created_at, changed_by, from_owners, to_owners, reason, whole_company",
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load ownership changes: ${error.message}`);
  }
  const name = (id: string) => nameOf.get(id) ?? "Unnamed";
  return changeRows.parse(data).map((row) => ({
    id: row.id,
    at: row.created_at,
    changedBy: name(row.changed_by),
    from: row.from_owners.map(name),
    to: row.to_owners.map(name),
    reason: row.reason,
    wholeCompany: row.whole_company,
  }));
}
