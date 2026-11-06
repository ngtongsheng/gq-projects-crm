"use client";

import { Pencil, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { type DuplicateContact, saveContact } from "./actions";
import { RequestOwnershipDialog } from "./ownership/request-ownership-dialog";
import {
  AccountType,
  AccountTypeLabel,
  CompanyType,
  CompanyTypeLabel,
  RatingLabel,
} from "./schemas";

export type EditableContact = {
  id: string;
  companyId: string;
  name: string;
  /** Written the way people type it, e.g. 012-345 6789. */
  mobile: string;
  title: string;
  accountType: AccountType;
  passedBy: string;
  notes: string;
};

type ContactDialogProps = {
  /** Present when editing; absent when adding. */
  contact?: EditableContact;
  companies: { id: string; name: string; rating: number }[];
  team: { id: string; name: string }[];
  /** MD and Sales Director choose the account type; everyone else adds own-effort accounts. */
  canSetAccountType: boolean;
  /** MD and Sales Director change the rating of a company that already exists. */
  canRateCompany: boolean;
  /** Salespeople who hit a customer someone else owns can ask for it. */
  canRequestOwnership: boolean;
};

const NEW_COMPANY = "new";

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function ContactDialog(props: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const editing = props.contact !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        ) : (
          <Button>
            <UserPlus data-icon="inline-start" />
            Add customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit customer" : "Add customer"}
          </DialogTitle>
          <DialogDescription>
            The mobile number decides who owns the customer.
          </DialogDescription>
        </DialogHeader>
        <ContactForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({
  contact,
  companies,
  team,
  canSetAccountType,
  canRateCompany,
  canRequestOwnership,
  onSaved,
}: ContactDialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateContact | null>(null);
  const [companyId, setCompanyId] = useState(contact?.companyId ?? "");
  const chosenCompany = companies.find((company) => company.id === companyId);
  const [accountType, setAccountType] = useState<AccountType>(
    contact?.accountType ?? "own",
  );

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveContact(formData);
      setError(result.error);
      setDuplicate(result.duplicate);
      if (!result.error && !result.duplicate) {
        toast.success(contact ? "Customer saved." : "Customer added.");
        onSaved();
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      {contact && <input type="hidden" name="contactId" value={contact.id} />}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="companyId">Company</FieldLabel>
          <Select
            name="companyId"
            value={companyId}
            onValueChange={setCompanyId}
          >
            <SelectTrigger id="companyId">
              <SelectValue placeholder="Choose a company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_COMPANY}>New company...</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {companyId === NEW_COMPANY && (
          <>
            <Field>
              <FieldLabel htmlFor="newCompanyName">Company name</FieldLabel>
              <Input id="newCompanyName" name="newCompanyName" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="newCompanyType">Company type</FieldLabel>
              <Select name="newCompanyType" defaultValue="designer">
                <SelectTrigger id="newCompanyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CompanyType.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CompanyTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
        <Field>
          <FieldLabel htmlFor="name">Customer name</FieldLabel>
          <Input id="name" name="name" defaultValue={contact?.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mobile">Mobile</FieldLabel>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="tel"
              placeholder="012-345 6789"
              defaultValue={contact?.mobile}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="title">Position</FieldLabel>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Senior Designer"
              defaultValue={contact?.title}
            />
          </Field>
        </div>
        {duplicate && (
          <DuplicateNotice
            duplicate={duplicate}
            canRequestOwnership={canRequestOwnership}
          />
        )}
        {companyId !== "" &&
          (companyId === NEW_COMPANY || canRateCompany ? (
            <Field key={companyId}>
              <FieldLabel htmlFor="rating">Company rating</FieldLabel>
              <Select
                name="rating"
                defaultValue={String(chosenCompany?.rating ?? 3)}
              >
                <SelectTrigger id="rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RatingLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {value} · {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field>
              <FieldLabel>Company rating</FieldLabel>
              <p className="text-sm">
                {chosenCompany
                  ? `${chosenCompany.rating} · ${RatingLabel[chosenCompany.rating]}`
                  : "–"}
              </p>
              <FieldDescription>
                Only the MD or Sales Director change a company's rating.
              </FieldDescription>
            </Field>
          ))}
        {canSetAccountType ? (
          <>
            <Field>
              <FieldLabel htmlFor="accountType">Account type</FieldLabel>
              <Select
                name="accountType"
                value={accountType}
                onValueChange={(value) =>
                  setAccountType(AccountType.parse(value))
                }
              >
                <SelectTrigger id="accountType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AccountType.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {AccountTypeLabel[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {accountType === "pass_down" && (
              <Field>
                <FieldLabel htmlFor="passedBy">Passed down by</FieldLabel>
                <Select name="passedBy" defaultValue={contact?.passedBy}>
                  <SelectTrigger id="passedBy">
                    <SelectValue placeholder="Choose who" />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </>
        ) : (
          <FieldDescription>
            {contact
              ? `Account type: ${AccountTypeLabel[contact.accountType]}.`
              : "Saved under you as an own-effort account."}
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea id="notes" name="notes" defaultValue={contact?.notes} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save customer"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function DuplicateNotice({
  duplicate,
  canRequestOwnership,
}: {
  duplicate: DuplicateContact;
  canRequestOwnership: boolean;
}) {
  const owners = duplicate.ownerNames.join(" + ") || "nobody yet";
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg bg-warn-bg p-3 text-sm text-warn"
    >
      <p>
        {duplicate.ownedByMe
          ? `You already have this contact: ${duplicate.name}, ${duplicate.companyName}.`
          : `This number already belongs to ${duplicate.name}, ${duplicate.companyName}. Owned by ${owners}. You can't add it again.`}
      </p>
      {!duplicate.ownedByMe && canRequestOwnership && (
        <div className="self-start">
          <RequestOwnershipDialog
            contactId={duplicate.contactId}
            customerName={duplicate.name}
            ownerNames={duplicate.ownerNames}
          />
        </div>
      )}
    </div>
  );
}
