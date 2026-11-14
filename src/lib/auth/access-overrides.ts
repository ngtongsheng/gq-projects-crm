import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AccessKey, type AccessOverrides, RoleKey } from "./pages";

const accessRows = z.array(
  z.object({ role_key: RoleKey, page_key: AccessKey, allowed: z.boolean() }),
);

/** The MD's overrides from People's "What each role can see". Cached per request. */
export const loadAccessOverrides = cache(async (): Promise<AccessOverrides> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_page_access")
    .select("role_key, page_key, allowed");
  if (error) throw new Error(`Could not load page access: ${error.message}`);
  const overrides: AccessOverrides = {};
  for (const row of accessRows.parse(data)) {
    overrides[row.role_key] = {
      ...overrides[row.role_key],
      [row.page_key]: row.allowed,
    };
  }
  return overrides;
});
