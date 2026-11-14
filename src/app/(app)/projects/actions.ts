"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { AccountType } from "../customers/schemas";
import {
  canChoosePic,
  canCreateProject,
  canEditProject,
} from "./project-access";
import { projectFormSchema, projectIdSchema } from "./schemas";

export type ProjectResult = { error: string | null };

const fail = (error: string): ProjectResult => ({ error });

const RELOAD = "Could not find that project. Reload the page.";

const existingProjectRow = z.object({
  contact_id: z.string(),
  pic_id: z.string(),
  support_id: z.string().nullable(),
  commission_type: AccountType,
  passed_by: z.string().nullable(),
});

const customerRow = z.object({
  account_type: AccountType,
  passed_by: z.string().nullable(),
  contact_owners: z.array(z.object({ profile_id: z.string() })),
});

/** Adds a pipeline project, or changes one when the form carries a projectId. */
export async function saveProject(formData: FormData): Promise<ProjectResult> {
  const me = await requirePage("proj");
  const supabase = await createClient();

  const projectId = textField(formData, "projectId") || null;
  if (projectId && !projectIdSchema.safeParse(projectId).success) {
    return fail(RELOAD);
  }

  // Who the project is for, who runs it, and which commission rate applies, before the form is read.
  let contactId = textField(formData, "contactId");
  let picId = me.id;
  let commissionType: string = "own";
  let passedBy = "";
  let existing: z.infer<typeof existingProjectRow> | null = null;

  if (projectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("contact_id, pic_id, support_id, commission_type, passed_by")
      .eq("id", projectId)
      .maybeSingle();
    if (error) {
      console.error("Could not load project", error);
      return fail("Could not save the project. Try again.");
    }
    if (!data) return fail(RELOAD);
    existing = existingProjectRow.parse(data);
    if (
      !canEditProject(
        me.jobRole,
        me.id === existing.pic_id || me.id === existing.support_id,
      )
    ) {
      return fail(
        "Only the person in charge, the supporting salesperson, the MD or the Sales Director can change this project.",
      );
    }
    contactId = existing.contact_id;
    picId = existing.pic_id;
    commissionType = existing.commission_type;
    passedBy = existing.passed_by ?? "";
  } else {
    if (!z.uuid().safeParse(contactId).success) {
      return fail("Could not find that customer. Reload the page.");
    }
    const { data, error } = await supabase
      .from("contacts")
      .select("account_type, passed_by, contact_owners(profile_id)")
      .eq("id", contactId)
      .is("archived_at", null)
      .maybeSingle();
    if (error) {
      console.error("Could not load customer", error);
      return fail("Could not save the project. Try again.");
    }
    if (!data) return fail("Could not find that customer. Reload the page.");
    const customer = customerRow.parse(data);
    const ownsCustomer = customer.contact_owners.some(
      (owner) => owner.profile_id === me.id,
    );
    if (!canCreateProject(me.jobRole, ownsCustomer)) {
      return fail(
        "Only the customer's owners, the MD or the Sales Director can add a project for this customer.",
      );
    }
    // A new project starts on the customer's commission type; only the MD or Sales Director changes it.
    commissionType = customer.account_type;
    passedBy = customer.passed_by ?? "";
  }

  const manager = canChoosePic(me.jobRole);
  const parsed = projectFormSchema.safeParse({
    contactId,
    name: textField(formData, "name"),
    leadSource: textField(formData, "leadSource"),
    stage: textField(formData, "stage"),
    qtySqft: textField(formData, "qtySqft"),
    value: textField(formData, "value"),
    picId: manager ? textField(formData, "picId") : picId,
    supportId: textField(formData, "supportId"),
    commissionType: manager
      ? textField(formData, "commissionType")
      : commissionType,
    passedBy: manager ? textField(formData, "passedBy") : passedBy,
    nextAction: textField(formData, "nextAction"),
    nextActionDate: textField(formData, "nextActionDate"),
    notes: textField(formData, "notes"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }
  const form = parsed.data;

  const fields = {
    name: form.name,
    lead_source: form.leadSource,
    stage: form.stage,
    qty_sqft: form.qtySqft,
    value: form.value,
    pic_id: form.picId,
    support_id: form.supportId,
    passed_by: form.passedBy,
    commission_type: form.commissionType,
    next_action: form.nextAction,
    next_action_date: form.nextActionDate,
    notes: form.notes,
  };

  if (projectId && existing) {
    const { data, error } = await supabase
      .from("projects")
      .update(fields)
      .eq("id", projectId)
      .select("id");
    if (error) {
      console.error("Could not update project", error);
      return fail("Could not save the project. Try again.");
    }
    if (data.length === 0) {
      return fail(
        "Only the person in charge, the supporting salesperson, the MD or the Sales Director can change this project.",
      );
    }
  } else {
    const { error } = await supabase
      .from("projects")
      .insert({ contact_id: form.contactId, ...fields });
    if (error) {
      console.error("Could not save project", error);
      return fail("Could not save the project. Try again.");
    }
  }

  revalidatePath("/customers", "layout");
  revalidatePath("/projects");
  return { error: null };
}
