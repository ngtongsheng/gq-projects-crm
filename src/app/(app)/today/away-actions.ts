"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { SITE_OFF_KINDS } from "@/lib/domain/site-log";
import { optionalText, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";

export type AwayResult = { error: string | null };

const TRY_AGAIN = "Could not save. Try again.";
const NOT_SUPERVISOR = "Only a site supervisor can record a day away.";

const awayForm = z
  .object({
    kind: z.enum(SITE_OFF_KINDS, "Choose office or other."),
    startsOn: z.iso.date("Choose the first day."),
    endsOn: z.iso.date("Choose the last day."),
    note: optionalText(200, "Keep the note under 200 characters."),
  })
  .refine((away) => away.endsOn >= away.startsOn, {
    message: "The last day is before the first day.",
    path: ["endsOn"],
  });

const awayId = z.uuid({ error: "Could not find that day. Reload the page." });

/** Records the supervisor's own office or other days, so they are not asked to log those days. */
export async function addSiteOff(formData: FormData): Promise<AwayResult> {
  const me = await requirePage("today");
  const parsed = awayForm.safeParse({
    kind: textField(formData, "kind"),
    startsOn: textField(formData, "startsOn"),
    endsOn: textField(formData, "endsOn"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const away = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("site_off").insert({
    profile_id: me.id,
    kind: away.kind,
    starts_on: away.startsOn,
    ends_on: away.endsOn,
    note: away.note,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_SUPERVISOR };
    console.error("Could not save the day away", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/today");
  return { error: null };
}

/** Takes a day away back out, for a mistake. */
export async function removeSiteOff(id: string): Promise<AwayResult> {
  await requirePage("today");
  const parsed = awayId.safeParse(id);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_off")
    .delete()
    .eq("id", parsed.data);
  if (error) {
    if (error.code === "42501") return { error: NOT_SUPERVISOR };
    console.error("Could not remove the day away", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/today");
  return { error: null };
}
