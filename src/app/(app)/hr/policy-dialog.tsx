"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/app/file-upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LABEL,
  type PolicyCategory,
  type PolicyDocument,
} from "@/lib/domain/hr-policy";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { addPolicy, updatePolicy } from "./policy-actions";
import { type UploadedPolicyFile, uploadPolicyPdf } from "./policy-upload";

const NEW_POLICY = "new";

/**
 * Adds a policy (optionally replacing a current one) or, given `document`, edits one. The PDF is
 * uploaded under the document's id first; the save then records it with the rest.
 */
export function PolicyDialog({
  document,
  replaceable,
  today,
}: {
  /** The policy being edited; leave out to add a new one. */
  document?: PolicyDocument;
  /** The current policies a new one may replace. */
  replaceable: PolicyDocument[];
  today: string;
}) {
  const t = useT();
  const editing = document !== undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState(document?.id ?? "");
  const [replacesId, setReplacesId] = useState(NEW_POLICY);
  const [title, setTitle] = useState(document?.title ?? "");
  const [category, setCategory] = useState<PolicyCategory>(
    document?.category ?? POLICY_CATEGORIES[0],
  );
  const [isScheme, setIsScheme] = useState(
    document?.isCommissionScheme ?? false,
  );
  const [pdf, setPdf] = useState<UploadedPolicyFile | null>(null);

  function openChanged(next: boolean) {
    setOpen(next);
    if (!next) return;
    reset();
    if (!editing) setDocumentId(crypto.randomUUID());
  }

  function replaceChanged(id: string) {
    setReplacesId(id);
    const replaced = replaceable.find((candidate) => candidate.id === id);
    if (!replaced) return;
    setTitle(replaced.title);
    setCategory(replaced.category);
    setIsScheme(replaced.isCommissionScheme);
  }

  function reset() {
    setError(null);
    setReplacesId(NEW_POLICY);
    setTitle(document?.title ?? "");
    setCategory(document?.category ?? POLICY_CATEGORIES[0]);
    setIsScheme(document?.isCommissionScheme ?? false);
    setPdf(null);
  }

  function save(formData: FormData) {
    const text = (key: string) => {
      const value = formData.get(key);
      return typeof value === "string" ? value : "";
    };
    startTransition(async () => {
      const input = {
        id: documentId,
        replacesId: replacesId === NEW_POLICY ? null : replacesId,
        category,
        title,
        version: text("version"),
        effectiveOn: text("effectiveOn"),
        isCommissionScheme: isScheme,
        link: text("link"),
        note: text("note"),
        file: pdf,
      };
      const result = editing
        ? await updatePolicy(input)
        : await addPolicy(input);
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Saved."));
      setOpen(false);
    });
  }

  const noFile = document !== undefined && !document.fileName && !document.link;
  return (
    <Dialog open={open} onOpenChange={openChanged}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant={noFile ? "outline" : "ghost"}>
            {noFile ? t("Attach file") : t("Edit")}
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            {t("Add / update a policy")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("Edit policy") : t("Add or update a policy")}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? t("Adding a link replaces the PDF.")
              : t(
                  "If this replaces an existing policy, choose it below. The old one moves to Older versions.",
                )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues((formData) => save(formData))}>
          <FieldGroup>
            {!editing && (
              <Field>
                <FieldLabel htmlFor="policyReplaces">
                  {t("Replaces")}
                </FieldLabel>
                <Select value={replacesId} onValueChange={replaceChanged}>
                  <SelectTrigger id="policyReplaces">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_POLICY}>
                      {t("New policy")}
                    </SelectItem>
                    {replaceable.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.title} (v {candidate.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="policyTitle">{t("Title")}</FieldLabel>
              <Input
                id="policyTitle"
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="policyCategory">
                  {t("Category")}
                </FieldLabel>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as PolicyCategory)
                  }
                >
                  <SelectTrigger id="policyCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_CATEGORIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(POLICY_CATEGORY_LABEL[option])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="policyVersion">
                  {t("Version / date")}
                </FieldLabel>
                <Input
                  id="policyVersion"
                  name="version"
                  defaultValue={document?.version ?? today}
                  maxLength={40}
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="policyEffective">
                  {t("Effective from")}
                </FieldLabel>
                <Input
                  id="policyEffective"
                  name="effectiveOn"
                  type="date"
                  defaultValue={document?.effectiveOn ?? today}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="policyLink">
                  {t("Google Drive link")}
                </FieldLabel>
                <Input
                  id="policyLink"
                  name="link"
                  inputMode="url"
                  defaultValue={document?.link ?? ""}
                  maxLength={500}
                  placeholder="https://drive.google.com/..."
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>
                {t("Or upload the PDF")}
                {document?.fileName
                  ? ` (${t("now")}: ${document.fileName})`
                  : ""}
              </FieldLabel>
              <FileUpload
                label={t("PDF")}
                upload={async (picked) => {
                  const sent = await uploadPolicyPdf(documentId, picked);
                  if (sent.ok) setPdf(sent.file);
                  return sent.ok ? { ok: true } : sent;
                }}
              />
              <FieldDescription>
                {t("A link and a PDF can't both be kept. Use one.")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="policyNote">{t("Note")}</FieldLabel>
              <Input
                id="policyNote"
                name="note"
                defaultValue={document?.note ?? ""}
                maxLength={500}
                placeholder={t("What changed in this version")}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="policyScheme"
                checked={isScheme}
                onCheckedChange={(checked) => setIsScheme(checked === true)}
              />
              <Label htmlFor="policyScheme" className="font-normal">
                {t("This is the Sales Target & Commission Scheme appendix")}
              </Label>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
