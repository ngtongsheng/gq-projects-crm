"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditInstallers } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { INSTALLER_SKILLS } from "@/lib/domain/installer";
import { optionalText, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";

export type InstallerResult = { error: string | null };

const NOT_EDITOR =
  "Only the MD, Sales Director, site supervisors, Purchasing and whoever arranges stock can change installers.";
const NOT_FOUND = "Could not find that installer. Reload the page.";
const TRY_AGAIN = "Could not save the installer. Try again.";

const installerForm = z.object({
  installerId: z
    .union([z.literal(""), z.uuid({ error: NOT_FOUND })])
    .transform((value) => (value === "" ? null : value)),
  // The database keeps names single-spaced; two spellings that differ only in spacing are one person.
  name: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, "Key in the name.")
        .max(100, "Keep the name under 100 characters."),
    ),
  company: optionalText(100, "Keep the company under 100 characters."),
  phone: optionalText(30, "Keep the phone number under 30 characters.").refine(
    (value) => value !== null,
    "Key in the phone number.",
  ),
  phone2: optionalText(30, "Keep phone 2 under 30 characters."),
  skills: z.array(z.enum(INSTALLER_SKILLS, "Choose skills from the list.")),
  description: optionalText(500, "Keep what they can do under 500 characters."),
  area: optionalText(100, "Keep the area under 100 characters."),
  notes: optionalText(500, "Keep the notes under 500 characters."),
  // Only the edit form has the tick; a new installer starts active.
  active: z.boolean(),
});

/** Adds an installer to the directory, or saves changes to one (`installerId`). Never deletes: stopping work is Active off. */
export async function saveInstaller(
  formData: FormData,
): Promise<InstallerResult> {
  const me = await requirePage("inst");
  if (!canEditInstallers(me)) return { error: NOT_EDITOR };

  const parsed = installerForm.safeParse({
    installerId: textField(formData, "installerId"),
    name: textField(formData, "name"),
    company: textField(formData, "company"),
    phone: textField(formData, "phone"),
    phone2: textField(formData, "phone2"),
    skills: formData.getAll("skills"),
    description: textField(formData, "description"),
    area: textField(formData, "area"),
    notes: textField(formData, "notes"),
    active:
      formData.get("installerId") === "" || formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { installerId, ...installer } = parsed.data;

  const values = {
    name: installer.name,
    company: installer.company,
    phone: installer.phone,
    phone2: installer.phone2,
    skills: installer.skills,
    description: installer.description,
    area: installer.area,
    notes: installer.notes,
    active: installer.active,
  };

  const supabase = await createClient();
  const result = installerId
    ? await supabase
        .from("installers")
        .update(values)
        .eq("id", installerId)
        .select("id")
    : await supabase.from("installers").insert(values);
  if (result.error) {
    if (result.error.code === "23505") {
      return { error: `${installer.name} is already in the list.` };
    }
    if (result.error.code === "42501") return { error: NOT_EDITOR };
    console.error("Could not save the installer", result.error);
    return { error: TRY_AGAIN };
  }
  if (installerId && result.data?.length === 0) return { error: NOT_FOUND };

  revalidatePath("/installation");
  return { error: null };
}
