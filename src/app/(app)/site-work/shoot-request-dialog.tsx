"use client";

import { Plus } from "lucide-react";
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
import {
  SHOOT_KIND_LABEL,
  SHOOT_KINDS,
  type ShootKind,
} from "@/lib/domain/site-photos";
import { isOneOf } from "@/lib/form/one-of";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { requestShooting } from "./measurement-photo-actions";

const ANYONE = "anyone";

type Option = { id: string; label: string };

/** Asks the site team for good photos or video of a job site worth showing (demo: sheetShootReq). */
export function ShootRequestDialog({
  mofs,
  supervisors,
  today,
  defaultDue,
}: {
  mofs: readonly Option[];
  supervisors: readonly Option[];
  today: string;
  defaultDue: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mof, setMof] = useState("");
  const [kind, setKind] = useState<ShootKind>("photos");
  const [supervisor, setSupervisor] = useState(ANYONE);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await requestShooting(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(t("Shooting requested. Site supervisors will see it."));
        setMof("");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          {t("Request shooting")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Request photo / video shooting")}</DialogTitle>
          <DialogDescription>
            {t(
              "For a job site worth showing. The site supervisor takes many photos or a video and posts them in the job site WhatsApp group; sales support saves them to Google Drive.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="mofId" value={mof} />
          <input type="hidden" name="kind" value={kind} />
          <input
            type="hidden"
            name="supervisorId"
            value={supervisor === ANYONE ? "" : supervisor}
          />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="shoot-mof">{t("MOF · project")}</FieldLabel>
              <Select value={mof} onValueChange={setMof}>
                <SelectTrigger id="shoot-mof">
                  <SelectValue placeholder={t("Choose the MOF")} />
                </SelectTrigger>
                <SelectContent>
                  {mofs.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="shoot-kind">{t("What")}</FieldLabel>
                <Select
                  value={kind}
                  onValueChange={(value) => {
                    if (isOneOf(SHOOT_KINDS, value)) setKind(value);
                  }}
                >
                  <SelectTrigger id="shoot-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOOT_KINDS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(SHOOT_KIND_LABEL[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="shoot-due">{t("Due date")}</FieldLabel>
                <Input
                  id="shoot-due"
                  name="dueOn"
                  type="date"
                  min={today}
                  defaultValue={defaultDue}
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="shoot-supervisor">
                  {t("Site supervisor")}
                </FieldLabel>
                <Select value={supervisor} onValueChange={setSupervisor}>
                  <SelectTrigger id="shoot-supervisor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANYONE}>
                      {t("Whoever is on site")}
                    </SelectItem>
                    {supervisors.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="shoot-best">
                  {t("Best date (optional)")}
                </FieldLabel>
                <Input id="shoot-best" name="bestOn" type="date" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="shoot-note">
                {t("Why / what to capture")}
              </FieldLabel>
              <Input
                id="shoot-note"
                name="note"
                maxLength={300}
                placeholder={t(
                  "e.g. Nice reception area, take the feature wall and corridor",
                )}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Send request")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
