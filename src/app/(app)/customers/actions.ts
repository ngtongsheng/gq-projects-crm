"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import {
  canAddContact,
  canEditContact,
  canRateCompany,
  canSetAccountType,
} from "./contact-access";
import {
  companyFormSchema,
  companyRatingSchema,
  contactFormSchema,
} from "./schemas";

export type DuplicateContact = {
  contactId: string;
  name: string;
  companyName: string;
  ownerNames: string[];
  /** The signed-in person already owns this contact. */
  ownedByMe: boolean;
};

export type SaveContactResult = {
  error: string | null;
  duplicate: DuplicateContact | null;
};

const fail = (error: string): SaveContactResult => ({
  error,
  duplicate: null,
});

const UNIQUE_VIOLATION = "23505";
const COMPANY_NAME_KEY = "companies_name_key";
const NEW_COMPANY = "new";

const existingContactRow = z.object({
  account_type: z.string(),
  passed_by: z.string().nullable(),
  contact_owners: z.array(z.object({ profile_id: z.string() })),
});

const duplicateRow = z.object({
  id: z.string(),
  name: z.string(),
  companies: z.object({ name: z.string() }),
  contact_owners: z.array(z.object({ profile_id: z.string() })),
});

/** Adds a customer, or changes one when the form carries a contactId. */
export async function saveContact(
  formData: FormData,
): Promise<SaveContactResult> {
  const me = await requirePage("cust");
  if (!canAddContact(me.jobRole)) {
    return fail("Your role can view customers but not change them.");
  }

  const contactId = textField(formData, "contactId") || null;
  if (contactId && !z.uuid().safeParse(contactId).success) {
    return fail("Could not find that customer. Reload the page.");
  }

  const supabase = await createClient();

  let kept: { accountType: string; passedBy: string } | null = null;
  if (contactId) {
    const { data, error } = await supabase
      .from("contacts")
      .select("account_type, passed_by, contact_owners(profile_id)")
      .eq("id", contactId)
      .maybeSingle();
    if (error) {
      console.error("Could not load customer", error);
      return fail("Could not save the customer. Try again.");
    }
    if (!data) return fail("That customer no longer exists. Reload the page.");
    const existing = existingContactRow.parse(data);
    const isOwner = existing.contact_owners.some(
      (owner) => owner.profile_id === me.id,
    );
    if (!canEditContact(me.jobRole, isOwner)) {
      return fail(
        "Only the owners, the MD or the Sales Director can change this customer.",
      );
    }
    kept = {
      accountType: existing.account_type,
      passedBy: existing.passed_by ?? "",
    };
  }

  const canChooseAccount = canSetAccountType(me.jobRole);
  const companyChoice = textField(formData, "companyId");
  const isNewCompany = companyChoice === NEW_COMPANY;

  const contact = contactFormSchema.safeParse({
    // A new company has no id yet; save_contact replaces this with the real one.
    companyId: isNewCompany ? crypto.randomUUID() : companyChoice,
    name: textField(formData, "name"),
    mobile: textField(formData, "mobile"),
    title: textField(formData, "title"),
    accountType: canChooseAccount
      ? textField(formData, "accountType")
      : (kept?.accountType ?? "own"),
    passedBy: canChooseAccount
      ? textField(formData, "passedBy")
      : (kept?.passedBy ?? ""),
    notes: textField(formData, "notes"),
  });
  if (!contact.success) {
    return fail(contact.error.issues[0]?.message ?? "Check the details.");
  }

  const newCompany = isNewCompany
    ? companyFormSchema.safeParse({
        name: textField(formData, "newCompanyName"),
        companyType: textField(formData, "newCompanyType"),
        rating: textField(formData, "rating"),
        accountType: "",
        passedBy: "",
        address: "",
        notes: "",
      })
    : null;
  if (newCompany && !newCompany.success) {
    return fail(newCompany.error.issues[0]?.message ?? "Check the company.");
  }

  // An existing company's rating is the MD's or Sales Director's to change.
  const ratingChoice = textField(formData, "rating");
  const newRating =
    !isNewCompany && canRateCompany(me.jobRole) && ratingChoice !== ""
      ? companyRatingSchema.safeParse(ratingChoice)
      : null;
  if (newRating && !newRating.success) {
    return fail(newRating.error.issues[0]?.message ?? "Choose a rating.");
  }

  const duplicateQuery = supabase
    .from("contacts")
    .select("id, name, companies(name), contact_owners(profile_id)")
    .eq("mobile", contact.data.mobile);
  const { data: duplicateData, error: duplicateError } = await (contactId
    ? duplicateQuery.neq("id", contactId)
    : duplicateQuery
  ).maybeSingle();
  if (duplicateError) {
    console.error("Could not check the mobile number", duplicateError);
    return fail("Could not save the customer. Try again.");
  }
  if (duplicateData) {
    const found = duplicateRow.parse(duplicateData);
    const ownerIds = found.contact_owners.map((owner) => owner.profile_id);
    const team = await getTeamDirectory();
    return {
      error: null,
      duplicate: {
        contactId: found.id,
        name: found.name,
        companyName: found.companies.name,
        ownerNames: ownerIds.map(
          (id) => team.find((member) => member.id === id)?.name ?? "Unnamed",
        ),
        ownedByMe: ownerIds.includes(me.id),
      },
    };
  }

  const row = {
    company_id: contact.data.companyId,
    name: contact.data.name,
    mobile: contact.data.mobile,
    title: contact.data.title,
    account_type: contact.data.accountType,
    passed_by: contact.data.passedBy,
    notes: contact.data.notes,
  };

  // One call, one transaction: a new company is saved with the customer or not at all.
  // RLS hides rows the caller may not edit, which the function reports as an error.
  // A company object with only a rating changes the rating of the company already chosen.
  let companyPart: Record<string, unknown> | null = null;
  if (newCompany?.success) {
    companyPart = {
      name: newCompany.data.name,
      company_type: newCompany.data.companyType,
      rating: newCompany.data.rating,
    };
  } else if (newRating?.success) {
    companyPart = { rating: newRating.data };
  }
  const { error } = await supabase.rpc("save_contact", {
    contact_id: contactId,
    contact: row,
    company: companyPart,
  });
  if (error?.code === UNIQUE_VIOLATION) {
    return fail(
      error.message.includes(COMPANY_NAME_KEY)
        ? "A company with that name already exists. Choose it from the list."
        : "Another customer already uses that mobile number.",
    );
  }
  if (error) {
    console.error("Could not save customer", error);
    return fail("Could not save the customer. Try again.");
  }

  revalidatePath("/customers");
  return { error: null, duplicate: null };
}
