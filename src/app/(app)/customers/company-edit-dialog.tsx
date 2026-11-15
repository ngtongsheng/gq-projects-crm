"use client";

import { Pencil } from "lucide-react";
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
import { saveCompany } from "./actions";
import {
  AccountType,
  AccountTypeLabel,
  CompanyType,
  CompanyTypeLabel,
  RatingLabel,
} from "./schemas";

export type EditableCompany = {
  id: string;
  name: string;
  companyType: CompanyType;
  rating: number;
  accountType: AccountType | null;
  passedBy: string;
  address: string;
  notes: string;
};

type CompanyEditDialogProps = {
  company: EditableCompany;
  team: { id: string; name: string }[];
};

// Radix Select has no empty item value, so "not fixed" gets a name and posts as blank.
const NOT_FIXED = "not_fixed";

/** Radix unmounts the content on close, so each opening starts from the saved values. */
export function CompanyEditDialog(props: CompanyEditDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil data-icon="inline-start" />
          Edit company
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
          <DialogDescription>
            The type applies to everyone at this company.
          </DialogDescription>
        </DialogHeader>
        <CompanyEditForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CompanyEditForm({
  company,
  team,
  onSaved,
}: CompanyEditDialogProps & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [commission, setCommission] = useState<string>(
    company.accountType ?? NOT_FIXED,
  );

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveCompany(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Company saved.");
        onSaved();
      }
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      <input type="hidden" name="companyId" value={company.id} />
      <input
        type="hidden"
        name="accountType"
        value={commission === NOT_FIXED ? "" : commission}
      />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="companyName">Company</FieldLabel>
          <Input
            id="companyName"
            name="name"
            defaultValue={company.name}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="companyType">Company type</FieldLabel>
            <Select name="companyType" defaultValue={company.companyType}>
              <SelectTrigger id="companyType">
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
          <Field>
            <FieldLabel htmlFor="companyRating">Company rating</FieldLabel>
            <Select name="rating" defaultValue={String(company.rating)}>
              <SelectTrigger id="companyRating">
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
        </div>
        <Field>
          <FieldLabel htmlFor="companyCommission">
            Commission type for its projects
          </FieldLabel>
          <Select value={commission} onValueChange={setCommission}>
            <SelectTrigger id="companyCommission">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_FIXED}>
                Not fixed · salesperson chooses
              </SelectItem>
              {AccountType.options.map((type) => (
                <SelectItem key={type} value={type}>
                  {AccountTypeLabel[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {commission === "pass_down" && (
          <Field>
            <FieldLabel htmlFor="companyPassedBy">Passed down by</FieldLabel>
            <Select name="passedBy" defaultValue={company.passedBy}>
              <SelectTrigger id="companyPassedBy">
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
        <Field>
          <FieldLabel htmlFor="companyAddress">Address</FieldLabel>
          <Input
            id="companyAddress"
            name="address"
            defaultValue={company.address}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="companyNotes">Notes</FieldLabel>
          <Textarea
            id="companyNotes"
            name="notes"
            defaultValue={company.notes}
          />
          <FieldDescription>
            Who a company's salespeople are follows from who owns its people.
          </FieldDescription>
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save company"}
        </Button>
      </FieldGroup>
    </form>
  );
}
