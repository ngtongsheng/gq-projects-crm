import { z } from "zod";
import {
  CLAIM_THRESHOLD_KEY,
  COMMISSION_SETTINGS_KEY,
  type CommissionSettings,
  settingsFromStored,
} from "@/lib/domain/commission-settings";
import { createClient } from "@/lib/supabase/server";

const settingRows = z.array(z.object({ key: z.string(), value: z.unknown() }));

/** The commission rules the MD set, or the defaults until she saves her own. */
export async function loadCommissionSettings(): Promise<CommissionSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [COMMISSION_SETTINGS_KEY, CLAIM_THRESHOLD_KEY]);
  if (error) {
    throw new Error(`Could not load commission settings: ${error.message}`);
  }

  const byKey = new Map(
    settingRows.parse(data).map((row) => [row.key, row.value]),
  );
  const { settings, valid } = settingsFromStored({
    rules: byKey.get(COMMISSION_SETTINGS_KEY),
    claimThresholdPct: byKey.get(CLAIM_THRESHOLD_KEY),
  });
  if (!valid) {
    console.error("Stored commission settings are unreadable; using defaults");
  }
  return settings;
}
