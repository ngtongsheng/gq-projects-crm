import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const teamIds = z.array(z.uuid()).nullable();

/**
 * Profile ids whose sales and money I see, or null for everyone, straight from public.my_team().
 * Staff cannot read other profiles, so the database works the team out. Cached per request.
 */
export const loadMyTeam = cache(async (): Promise<string[] | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_team");
  if (error) throw new Error(`Could not load your team: ${error.message}`);
  return teamIds.parse(data);
});
