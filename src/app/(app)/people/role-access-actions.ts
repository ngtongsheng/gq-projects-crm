"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccessKey, defaultAllowed, RoleKey } from "@/lib/auth/pages";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export type RoleAccessResult = { error: string | null };

const ONLY_MD = "Only the Managing Director can change what each role sees.";
const FAILED = "Could not save that. Try again.";

const accessCell = z.object({
  roleKey: RoleKey.exclude(["md"]),
  key: AccessKey,
  allowed: z.boolean(),
});

/**
 * Ticks or unticks one box in "What each role can see". A box back at its default keeps no
 * row, so later changes to the defaults reach that role.
 */
export async function setRoleAccess(input: unknown): Promise<RoleAccessResult> {
  const me = await requireRole("admin");
  if (me.jobRole !== "md") return { error: ONLY_MD };
  const parsed = accessCell.safeParse(input);
  if (!parsed.success) return { error: "Choose a page and a role." };
  const { roleKey, key, allowed } = parsed.data;

  const supabase = await createClient();
  const { error } =
    allowed === defaultAllowed(roleKey, key)
      ? await supabase
          .from("role_page_access")
          .delete()
          .eq("role_key", roleKey)
          .eq("page_key", key)
      : await supabase
          .from("role_page_access")
          .upsert({ role_key: roleKey, page_key: key, allowed });
  if (error) {
    console.error("Could not save role access", error);
    return { error: FAILED };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

/** "Back to default": removes every override. */
export async function resetRoleAccess(): Promise<RoleAccessResult> {
  const me = await requireRole("admin");
  if (me.jobRole !== "md") return { error: ONLY_MD };

  const supabase = await createClient();
  const { error } = await supabase
    .from("role_page_access")
    .delete()
    .not("role_key", "is", null);
  if (error) {
    console.error("Could not reset role access", error);
    return { error: FAILED };
  }
  revalidatePath("/", "layout");
  return { error: null };
}
