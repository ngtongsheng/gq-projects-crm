"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { textField } from "@/lib/form/form-fields";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { expenseLogHref } from "./marketing-expense-filters";
import {
  VENDOR_SKILL_LABEL,
  VENDOR_SKILLS,
  VENDOR_SUPPLIES,
  VENDOR_SUPPLY_LABEL,
  type VendorKind,
  type VendorSkill,
  type VendorSupply,
} from "./marketing-options";
import {
  deleteMarketingVendor,
  saveMarketingVendor,
} from "./marketing-vendor-actions";
import type { VendorRow } from "./marketing-vendors";

const NO_SUPPLY = "none";

type MarketingVendorDialogProps = {
  /** The vendor being edited; leave out to add one. */
  vendor?: VendorRow;
  /** The kind a new vendor starts as, from the button that was clicked. */
  startKind: VendorKind;
  onClose: () => void;
};

/** Adds or edits a company or a part-timer (demo sheetMkVend). Mounted while open, so each opening starts from the vendor. */
export function MarketingVendorDialog({
  vendor,
  startKind,
  onClose,
}: MarketingVendorDialogProps) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [kind, setKind] = useState<VendorKind>(vendor?.kind ?? startKind);
  const [supplies, setSupplies] = useState<VendorSupply | typeof NO_SUPPLY>(
    vendor?.supplies ?? NO_SUPPLY,
  );
  const [skills, setSkills] = useState<VendorSkill[]>(vendor?.skills ?? []);

  const toggleSkill = (skill: VendorSkill, on: boolean) =>
    setSkills((current) =>
      on ? [...current, skill] : current.filter((s) => s !== skill),
    );

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveMarketingVendor({
        id: vendor?.id ?? "",
        kind,
        name: textField(formData, "name"),
        supplies: supplies === NO_SUPPLY ? "" : supplies,
        contactPerson: textField(formData, "contactPerson"),
        skills,
        rate: textField(formData, "rate"),
        portfolioUrl: textField(formData, "portfolioUrl"),
        phone: textField(formData, "phone"),
        email: textField(formData, "email"),
        notes: textField(formData, "notes"),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(vendor ? t("Saved") : t("Vendor added"));
      onClose();
    });
  }

  function remove() {
    if (!vendor) return;
    startTransition(async () => {
      const result = await deleteMarketingVendor(vendor.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Vendor deleted."));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vendor ? t("Edit vendor") : t("Add vendor")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Pay a part-timer by adding an expense with their name as the vendor.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={kind === "company" ? "default" : "outline"}
                aria-pressed={kind === "company"}
                onClick={() => setKind("company")}
              >
                {t("Company")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kind === "part_timer" ? "default" : "outline"}
                aria-pressed={kind === "part_timer"}
                onClick={() => setKind("part_timer")}
              >
                {t("Part-timer")}
              </Button>
            </div>
            <Field>
              <FieldLabel htmlFor="vendorName">{t("Name")} *</FieldLabel>
              <Input
                id="vendorName"
                name="name"
                defaultValue={vendor?.name}
                maxLength={200}
                required
              />
            </Field>
            {kind === "company" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="vendorSupplies">
                    {t("What they supply")}
                  </FieldLabel>
                  <Select
                    value={supplies}
                    onValueChange={(value) => {
                      if (
                        value === NO_SUPPLY ||
                        isOneOf(VENDOR_SUPPLIES, value)
                      )
                        setSupplies(value);
                    }}
                  >
                    <SelectTrigger id="vendorSupplies">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLY}>
                        {t("— Not set —")}
                      </SelectItem>
                      {VENDOR_SUPPLIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(VENDOR_SUPPLY_LABEL[value])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="vendorContact">
                    {t("Contact person")}
                  </FieldLabel>
                  <Input
                    id="vendorContact"
                    name="contactPerson"
                    defaultValue={vendor?.contactPerson ?? ""}
                    maxLength={200}
                  />
                </Field>
              </div>
            ) : (
              <>
                <Field>
                  <FieldLabel>{t("Skills")}</FieldLabel>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {VENDOR_SKILLS.map((skill) => (
                      <Field
                        key={skill}
                        orientation="horizontal"
                        className="w-auto"
                      >
                        <Checkbox
                          id={`vendorSkill-${skill}`}
                          checked={skills.includes(skill)}
                          onCheckedChange={(checked) =>
                            toggleSkill(skill, checked === true)
                          }
                        />
                        <FieldLabel
                          htmlFor={`vendorSkill-${skill}`}
                          className="font-normal"
                        >
                          {t(VENDOR_SKILL_LABEL[skill])}
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="vendorRate">
                      {t("Pay rate")}
                    </FieldLabel>
                    <Input
                      id="vendorRate"
                      name="rate"
                      defaultValue={vendor?.rate ?? ""}
                      maxLength={200}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="vendorPortfolio">
                      {t("Portfolio link")}
                    </FieldLabel>
                    <Input
                      id="vendorPortfolio"
                      name="portfolioUrl"
                      defaultValue={vendor?.portfolioUrl ?? ""}
                      maxLength={500}
                    />
                  </Field>
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="vendorPhone">
                  {t("Phone / WhatsApp")}
                </FieldLabel>
                <Input
                  id="vendorPhone"
                  name="phone"
                  type="tel"
                  defaultValue={vendor?.phone ?? ""}
                  maxLength={40}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="vendorEmail">{t("Email")}</FieldLabel>
                <Input
                  id="vendorEmail"
                  name="email"
                  type="email"
                  defaultValue={vendor?.email ?? ""}
                  maxLength={200}
                />
              </Field>
            </div>
            {kind === "part_timer" && (
              <FieldDescription>
                {t("A part-timer needs a phone number or an email.")}
              </FieldDescription>
            )}
            <Field>
              <FieldLabel htmlFor="vendorNotes">{t("Notes")}</FieldLabel>
              <Textarea
                id="vendorNotes"
                name="notes"
                rows={2}
                defaultValue={vendor?.notes ?? ""}
                maxLength={1000}
              />
            </Field>
            {error && <FieldError>{t(error)}</FieldError>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? t("Saving...") : t("Save")}
              </Button>
              {vendor && (
                <Button type="button" variant="outline" asChild>
                  <Link href={expenseLogHref({ query: vendor.name })}>
                    {t("See payments")}
                  </Link>
                </Button>
              )}
              {vendor &&
                (vendor.used > 0 ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("In use, so it can't be deleted.")}
                  </span>
                ) : asking ? (
                  <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                    {t("Delete this vendor?")}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={remove}
                      disabled={pending}
                    >
                      {t("Yes, delete")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAsking(false)}
                    >
                      {t("Keep")}
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-auto text-bad"
                    onClick={() => setAsking(true)}
                  >
                    {t("Delete")}
                  </Button>
                ))}
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
