import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type StockSettings = { holdDays: number; warningDays: number };

const settingRows = z.array(
  z.object({ key: z.string(), value: z.number().int() }),
);

/** How long a hold runs and how early it warns. Seeded by the stock migration. */
export async function loadStockSettings(): Promise<StockSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["stock_hold_days", "stock_warning_days"]);
  if (error) throw new Error(`Could not load stock settings: ${error.message}`);

  const byKey = new Map(
    settingRows.parse(data).map((row) => [row.key, row.value]),
  );
  return {
    holdDays: byKey.get("stock_hold_days") ?? 14,
    warningDays: byKey.get("stock_warning_days") ?? 3,
  };
}
