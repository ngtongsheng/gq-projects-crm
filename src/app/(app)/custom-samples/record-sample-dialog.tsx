"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DeleteConfirm } from "@/components/app/delete-confirm";
import { FileUpload } from "@/components/app/file-upload";
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
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import { deleteCustomSample, saveCustomSample } from "./custom-sample-actions";
import { uploadCustomSamplePhoto } from "./custom-sample-photo-upload";
import type { CustomSample } from "./custom-sample-types";

type RecordSampleDialogProps = {
  /** The sample being edited; leave out to record a new one. */
  sample?: CustomSample;
  /** Suppliers already recorded, offered while typing. */
  suppliers: readonly string[];
};

function textOf(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Records a custom sample when it arrives from the supplier, or edits one (demo sheetTfRec). The
 * photo is uploaded under the sample's id first; the save then records it with the rest.
 */
export function RecordSampleDialog({
  sample,
  suppliers,
}: RecordSampleDialogProps) {
  const t = useT();
  const editing = sample !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [sampleId, setSampleId] = useState(sample?.id ?? "");
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  function openChanged(next: boolean) {
    setOpen(next);
    if (!next) return;
    setError(null);
    setAsking(false);
    setPhotoPath(null);
    setSampleId(sample?.id ?? crypto.randomUUID());
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveCustomSample({
        id: sampleId,
        editing,
        code: textOf(formData, "code"),
        receivedOn: textOf(formData, "receivedOn"),
        designName: textOf(formData, "designName"),
        designNo: textOf(formData, "designNo"),
        supplier: textOf(formData, "supplier"),
        size: textOf(formData, "size"),
        qty: textOf(formData, "qty"),
        notes: textOf(formData, "notes"),
        photoPath,
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(
        editing
          ? t("Saved")
          : `${textOf(formData, "code") || t("The sample")} ${t("recorded – salespeople can now borrow it")}`,
      );
      setOpen(false);
    });
  }

  function remove() {
    if (!sample) return;
    startTransition(async () => {
      const result = await deleteCustomSample(sample.id);
      setError(result.error);
      setAsking(false);
      if (result.error !== null) return;
      toast.success(t("Sample deleted."));
      setOpen(false);
    });
  }

  const canDelete =
    sample !== undefined &&
    sample.loans.length === 0 &&
    sample.givenOn === null;
  return (
    <Dialog open={open} onOpenChange={openChanged}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="ghost">
            {t("Edit")}
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            {t("Record new sample")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("Edit sample") : t("Record new custom sample")}
          </DialogTitle>
          <DialogDescription>
            {t("Record each strike-off when it arrives from the supplier.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="customSampleCode">
                  {t("Sample code")}
                </FieldLabel>
                <Input
                  id="customSampleCode"
                  name="code"
                  className="font-mono"
                  defaultValue={sample?.code}
                  maxLength={40}
                  placeholder={t("Blank for the next TS-###")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="customSampleReceived">
                  {t("Received date")} *
                </FieldLabel>
                <Input
                  id="customSampleReceived"
                  name="receivedOn"
                  type="date"
                  defaultValue={sample?.receivedOn ?? todayMyt()}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="customSampleName">
                {t("Design name / description")} *
              </FieldLabel>
              <Input
                id="customSampleName"
                name="designName"
                defaultValue={sample?.designName}
                maxLength={200}
                placeholder={t("e.g. Hotel lobby swirl – strike-off 2")}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="customSampleNo">
                  {t("Design no.")} *
                </FieldLabel>
                <Input
                  id="customSampleNo"
                  name="designNo"
                  defaultValue={sample?.designNo}
                  maxLength={100}
                  placeholder={t("e.g. GQ-HT-2611")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="customSampleSupplier">
                  {t("Supplier")}
                </FieldLabel>
                <Input
                  id="customSampleSupplier"
                  name="supplier"
                  list="customSampleSuppliers"
                  defaultValue={sample?.supplier ?? ""}
                  maxLength={200}
                />
                <datalist id="customSampleSuppliers">
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="customSampleSize">{t("Size")}</FieldLabel>
                <Input
                  id="customSampleSize"
                  name="size"
                  defaultValue={sample?.size ?? ""}
                  maxLength={100}
                  placeholder={t("e.g. 50 x 50 cm")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="customSampleQty">
                  {t("Qty (pcs)")}
                </FieldLabel>
                <Input
                  id="customSampleQty"
                  name="qty"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className="font-mono"
                  defaultValue={sample?.qty ?? 1}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>{t("Photo")}</FieldLabel>
              <FileUpload
                label={t("photo")}
                imagesOnly
                upload={async (picked) => {
                  const sent = await uploadCustomSamplePhoto(sampleId, picked);
                  if (!sent.ok) return sent;
                  setPhotoPath(sent.path);
                  return { ok: true };
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="customSampleNotes">{t("Notes")}</FieldLabel>
              <Textarea
                id="customSampleNotes"
                name="notes"
                rows={2}
                defaultValue={sample?.notes ?? ""}
                maxLength={1000}
                placeholder={t(
                  "e.g. made for P1520 tender, client project name, pile height",
                )}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <DeleteConfirm
              pending={pending}
              showDelete={canDelete}
              question={t("Delete this sample?")}
              asking={asking}
              onAskingChange={setAsking}
              onDelete={remove}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
