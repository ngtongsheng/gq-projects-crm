"use client";

import { ClipboardPaste } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  countActions,
  type DuplicateChoice,
  type ImportAction,
  type ImportCounts,
  type ImportPreview,
} from "@/lib/import/import-plan";

export type ImportKindOption<Kind extends string> = {
  value: Kind;
  label: string;
  /** Column headers the paste should carry; the first ones are required. */
  columns: readonly string[];
};

export type PasteImportRequest<Kind extends string> = {
  kind: Kind;
  text: string;
  onDuplicate: DuplicateChoice;
};

type PasteImportDialogProps<Kind extends string> = {
  title: string;
  description: string;
  kinds: readonly [ImportKindOption<Kind>, ...ImportKindOption<Kind>[]];
  /** False for lists that are only ever added to; hides the choice for rows already in the CRM. */
  canUpdate?: boolean;
  /** Server action: checks the paste and returns what would happen. */
  preview: (
    request: PasteImportRequest<Kind>,
  ) => Promise<{ error: string | null; preview: ImportPreview | null }>;
  /** Server action: checks the paste again and saves the valid rows. */
  save: (
    request: PasteImportRequest<Kind>,
  ) => Promise<{ error: string | null; counts: ImportCounts | null }>;
};

const actionBadge: Record<ImportAction, { tone: StatusTone; label: string }> = {
  add: { tone: "good", label: "Add" },
  update: { tone: "info", label: "Update" },
  skip: { tone: "neutral", label: "Skip, already in" },
  invalid: { tone: "bad", label: "Fix" },
};

function summary(counts: ImportCounts) {
  const parts = [
    counts.add > 0 && `${counts.add} to add`,
    counts.update > 0 && `${counts.update} to update`,
    counts.skip > 0 && `${counts.skip} already in, skipped`,
    counts.invalid > 0 && `${counts.invalid} to fix in the sheet`,
  ].filter((part) => part !== false);
  return parts.length > 0 ? `${parts.join(", ")}.` : "No rows found.";
}

/** Paste rows copied from a spreadsheet, check them, then save only the good ones. Radix unmounts the content on close, so each opening starts empty. */
export function PasteImportDialog<Kind extends string>(
  props: PasteImportDialogProps<Kind>,
) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardPaste data-icon="inline-start" />
          Paste from sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <PasteImportForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PasteImportForm<Kind extends string>({
  kinds,
  canUpdate = true,
  preview,
  save,
  onSaved,
}: PasteImportDialogProps<Kind> & { onSaved: () => void }) {
  const [kind, setKind] = useState<Kind>(kinds[0].value);
  const [text, setText] = useState("");
  const [onDuplicate, setOnDuplicate] = useState<DuplicateChoice>("skip");
  const [checked, setChecked] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = kinds.find((option) => option.value === kind) ?? kinds[0];
  const counts = checked ? countActions(checked.rows) : null;
  const toSave = counts ? counts.add + counts.update : 0;

  // Any change makes the checked rows stale.
  const changed = () => {
    setChecked(null);
    setError(null);
  };

  function check() {
    startTransition(async () => {
      const result = await preview({ kind, text, onDuplicate });
      setError(result.error);
      setChecked(result.preview);
    });
  }

  function confirm() {
    startTransition(async () => {
      const result = await save({ kind, text, onDuplicate });
      setError(result.error);
      if (result.counts) {
        toast.success(
          `Saved: ${result.counts.add} added, ${result.counts.update} updated.`,
        );
        onSaved();
      }
    });
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        {kinds.length > 1 && (
          <Field>
            <FieldLabel htmlFor="importKind">What are you pasting?</FieldLabel>
            <Select
              value={kind}
              onValueChange={(value) => {
                const next = kinds.find((option) => option.value === value);
                if (next) setKind(next.value);
                changed();
              }}
            >
              <SelectTrigger id="importKind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {canUpdate && (
          <Field>
            <FieldLabel htmlFor="importDuplicates">
              Rows already in the CRM
            </FieldLabel>
            <Select
              value={onDuplicate}
              onValueChange={(value) => {
                setOnDuplicate(value === "update" ? "update" : "skip");
                changed();
              }}
            >
              <SelectTrigger id="importDuplicates">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip them</SelectItem>
                <SelectItem value="update">
                  Update them from the sheet
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <Field>
        <FieldLabel htmlFor="importText">Rows from your sheet</FieldLabel>
        <Textarea
          id="importText"
          rows={6}
          className="font-mono text-xs"
          placeholder="Select the rows in Excel or Google Sheets, header row included, copy, and paste here."
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            changed();
          }}
        />
        <FieldDescription>
          Columns: {chosen.columns.join(", ")}.
        </FieldDescription>
      </Field>
      {checked && counts && (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{summary(counts)}</p>
          {checked.missing.length > 0 && (
            <p className="text-bad">
              Missing columns: {checked.missing.join(", ")}.
            </p>
          )}
          {checked.ignored.length > 0 && (
            <p className="text-muted-foreground">
              Not imported: {checked.ignored.join(", ")}.
            </p>
          )}
          {checked.rows.length > 0 && (
            <DataTable
              rows={checked.rows}
              getRowKey={(row) => String(row.line)}
              columns={[
                {
                  key: "line",
                  header: "Row",
                  numeric: true,
                  cell: (row) => row.line,
                },
                ...checked.headers.map((header, index) => ({
                  key: `cell-${index}`,
                  header,
                  cell: (row: ImportPreview["rows"][number]) =>
                    row.cells[index] || "–",
                })),
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => (
                    <div className="flex flex-col gap-1">
                      <StatusBadge tone={actionBadge[row.action].tone}>
                        {actionBadge[row.action].label}
                      </StatusBadge>
                      {row.errors.map((message) => (
                        <span key={message} className="text-xs text-bad">
                          {message}
                        </span>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending || text.trim() === ""}
          onClick={check}
        >
          {pending && !checked ? "Checking..." : "Check rows"}
        </Button>
        {checked && (
          <Button disabled={pending || toSave === 0} onClick={confirm}>
            {pending
              ? "Saving..."
              : `Save ${toSave} ${toSave === 1 ? "row" : "rows"}`}
          </Button>
        )}
      </div>
    </FieldGroup>
  );
}
