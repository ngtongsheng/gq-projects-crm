import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const vendorRows = z.array(z.object({ id: z.uuid(), name: z.string() }));

/**
 * The vendor with this name (any capitalisation), added when there is none yet: the expense form
 * takes a typed name, like the demo, and the database links by id.
 */
export async function findOrAddVendor(
  supabase: Supabase,
  name: string,
): Promise<{ id: string } | { error: { code?: string; message?: string } }> {
  const found = await supabase.from("marketing_vendors").select("id, name");
  if (found.error) return { error: found.error };
  const same = vendorRows
    .parse(found.data)
    .find((vendor) => vendor.name.toLowerCase() === name.toLowerCase());
  if (same) return { id: same.id };

  const added = await supabase
    .from("marketing_vendors")
    .insert({ name })
    .select("id")
    .single();
  if (added.error) return { error: added.error };
  return z.object({ id: z.uuid() }).parse(added.data);
}
