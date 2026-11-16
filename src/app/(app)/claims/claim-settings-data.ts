import { z } from "zod";
import { ClaimSettings } from "@/lib/domain/monthly-claim";
import { createClient } from "@/lib/supabase/server";

const settingRow = z.object({ value: ClaimSettings });

/** The claim settings, seeded by the monthly claims migration and changed by the MD or HR & Accounts. */
export async function loadClaimSettings(): Promise<ClaimSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "claims")
    .single();
  if (error) throw new Error(`Could not load claim settings: ${error.message}`);
  return settingRow.parse(data).value;
}
