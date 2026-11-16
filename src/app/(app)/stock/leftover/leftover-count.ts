import { z } from "zod";
import { leftoverAvailable } from "@/lib/domain/leftover";
import { createClient } from "@/lib/supabase/server";

const rows = z.array(
  z.object({
    qty: z.number(),
    leftover_allocations: z.array(z.object({ qty: z.number() })),
  }),
);

/** Leftover items at Best Link with some left after the uses for other projects, for the Stock segment label. */
export async function countLeftoverAvailable(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leftovers")
    .select("qty, leftover_allocations(qty)")
    .eq("status", "at_best_link");
  if (error)
    throw new Error(`Could not count leftover stock: ${error.message}`);
  return rows
    .parse(data)
    .filter((row) => leftoverAvailable(row.qty, row.leftover_allocations) > 0)
    .length;
}
