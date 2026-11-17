import { z } from "zod";
import { ClaimSettings } from "@/lib/domain/claim-month";
import { createClient } from "@/lib/supabase/server";

const settingRow = z.object({ value: ClaimSettings });

/** The claim cut-off day, stored in app_settings; nobody edits it in the app (loop 25, D7). */
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
