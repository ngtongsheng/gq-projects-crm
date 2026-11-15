"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REMINDER_CHANNEL_LABEL,
  REMINDER_CHANNELS,
  REMINDER_LANGUAGE_LABEL,
  REMINDER_LANGUAGES,
  type SiteReminderSettings,
  type SupervisorReminder,
} from "@/lib/domain/site-reminders";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { saveSiteReminders } from "./reminder-actions";

type Person = { id: string; name: string };

/**
 * The daily log reminder settings: when it goes, who gets the next morning's list, and how to
 * reach each supervisor. Only saved for the Integration loop to send from; nothing is sent.
 */
export function ReminderSettingsForm({
  settings,
  supervisors,
  recipients,
  canEdit,
}: {
  settings: SiteReminderSettings;
  supervisors: readonly (Person & { reminder: SupervisorReminder })[];
  /** Who can be picked for the next morning's list. */
  recipients: readonly Person[];
  canEdit: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveSiteReminders(formData);
      setError(result.error);
      if (!result.error) toast.success(t("Reminder settings saved."));
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="officeWhatsApp">
            {t("Office WhatsApp no. for balance stock (supervisors send here)")}
          </FieldLabel>
          <Input
            id="officeWhatsApp"
            name="officeWhatsApp"
            type="tel"
            inputMode="tel"
            maxLength={30}
            defaultValue={settings.officeWhatsApp}
            placeholder="012-345 6789"
            disabled={!canEdit}
            className="sm:max-w-64"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="dailyTime">
              {t("Send reminder at (Mon-Sat)")}
            </FieldLabel>
            <Input
              id="dailyTime"
              name="dailyTime"
              type="time"
              required
              defaultValue={settings.dailyTime}
              disabled={!canEdit}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="nextMorningTime">
              {t("Next morning, send the missing list at")}
            </FieldLabel>
            <Input
              id="nextMorningTime"
              name="nextMorningTime"
              type="time"
              required
              defaultValue={settings.nextMorningTime}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <FieldSet>
          <FieldLegend variant="label">
            {t("Send the missing list to")}
          </FieldLegend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {recipients.map((person) => (
              <div key={person.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`list-${person.id}`}
                  name="missingListTo"
                  value={person.id}
                  defaultChecked={settings.missingListTo.includes(person.id)}
                  disabled={!canEdit}
                />
                <Label htmlFor={`list-${person.id}`}>{person.name}</Label>
              </div>
            ))}
          </div>
        </FieldSet>
        {supervisors.map(({ id, name, reminder }) => (
          <FieldSet key={id} className="rounded-lg border p-3">
            <input type="hidden" name="supervisorId" value={id} />
            <FieldLegend variant="label">{name}</FieldLegend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor={`via-${id}`}>{t("Send by")}</FieldLabel>
                <Select
                  name={`via-${id}`}
                  defaultValue={reminder.via}
                  disabled={!canEdit}
                >
                  <SelectTrigger id={`via-${id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_CHANNELS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(REMINDER_CHANNEL_LABEL[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`whatsapp-${id}`}>
                  {t("WhatsApp no.")}
                </FieldLabel>
                <Input
                  id={`whatsapp-${id}`}
                  name={`whatsapp-${id}`}
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  defaultValue={reminder.whatsapp}
                  placeholder="012-345 6789"
                  disabled={!canEdit}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`email-${id}`}>{t("Email")}</FieldLabel>
                <Input
                  id={`email-${id}`}
                  name={`email-${id}`}
                  type="email"
                  maxLength={120}
                  defaultValue={reminder.email}
                  placeholder="name@gqprojects.com.my"
                  disabled={!canEdit}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`language-${id}`}>
                  {t("Language")}
                </FieldLabel>
                <Select
                  name={`language-${id}`}
                  defaultValue={reminder.language}
                  disabled={!canEdit}
                >
                  <SelectTrigger id={`language-${id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_LANGUAGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {REMINDER_LANGUAGE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldSet>
        ))}
        {error && <FieldError>{error}</FieldError>}
        {canEdit ? (
          <Button type="submit" disabled={pending} className="sm:w-fit">
            {pending ? t("Saving...") : t("Save reminders")}
          </Button>
        ) : (
          <FieldDescription>
            {t("Only the MD or an admin can change the reminders.")}
          </FieldDescription>
        )}
      </FieldGroup>
    </form>
  );
}
