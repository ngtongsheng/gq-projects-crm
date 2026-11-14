"use client";

import { Check, CopyPlus, Send, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Readiness } from "@/lib/domain/quote-status";
import { useT } from "@/lib/i18n/language-context";
import type { Translate } from "@/lib/i18n/translate";
import type { QuoteStatus } from "../quote-view";
import {
  type ApprovalResult,
  approveCosting,
  chooseOption,
  openRevision,
  returnCosting,
  sendCosting,
} from "./approval-actions";

const APPROVERS = "the MD or Sales Director";

/** The readiness problems the domain writes in English; the two with a count or option letter are matched by shape. */
function translateProblem(t: Translate, problem: string): string {
  const noLines = /^Option (\S+) has no lines yet\.$/.exec(problem);
  if (noLines) {
    return `${t("Option")} ${noLines[1]} ${t("has no lines yet.")}`;
  }
  const unpriced =
    /^(\d+) (line has|lines have) no price for the customer yet\.$/.exec(
      problem,
    );
  if (unpriced) {
    return `${unpriced[1]} ${t(unpriced[2] === "line has" ? "line has no price for the customer yet." : "lines have no price for the customer yet.")}`;
  }
  return t(problem);
}

/**
 * The demo's action bar under a costing: the owner confirms or sends it, the MD or Sales Director
 * approves or returns it, and once it is OK to quote the owner records the customer's option or
 * opens a new version. The server decides again; this only offers the step that applies.
 */
export function ApprovalBar({
  revisionId,
  status,
  nextRevisionName,
  isOwner,
  isApprover,
  isLatest,
  readiness,
  options,
  chosenOptionId,
}: {
  revisionId: string;
  status: QuoteStatus;
  /** What a new version would be called, e.g. Q100-R2. */
  nextRevisionName: string;
  isOwner: boolean;
  isApprover: boolean;
  isLatest: boolean;
  /** Worked out on the server from the saved costing; null when the person does not own it. */
  readiness: Readiness | null;
  options: { id: string; key: string; label: string }[];
  chosenOptionId: string | null;
}) {
  const t = useT();
  const approvers = t(APPROVERS);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function run(action: () => Promise<ApprovalResult>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(t(result.error));
        return;
      }
      toast.success(t(done));
      setNote("");
      router.refresh();
    });
  }

  function revise() {
    startTransition(async () => {
      const result = await openRevision({ revisionId });
      if (result.error) {
        toast.error(t(result.error));
        return;
      }
      toast.success(
        `${nextRevisionName} ${t("opened. You can change it now.")}`,
      );
      router.push(`?rev=${result.rev}`);
      router.refresh();
    });
  }

  if (status === "submitted" && isApprover) {
    return (
      <Bar>
        <NoteBox
          label={t("Note (needed to return it)")}
          placeholder={t("What should the salesperson change?")}
          value={note}
          onChange={setNote}
        />
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            run(
              () => returnCosting({ revisionId, note }),
              "Returned to the salesperson.",
            )
          }
        >
          <Undo2 data-icon="inline-start" />
          {t("Return for changes")}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => approveCosting({ revisionId, note }),
              "Approved. OK to quote.",
            )
          }
        >
          <Check data-icon="inline-start" />
          {t("Approve")}
        </Button>
      </Bar>
    );
  }

  if (isOwner && readiness && status !== "approved") {
    if (!readiness.ready) {
      return <Hint>{translateProblem(t, readiness.problem)}</Hint>;
    }
    if (readiness.ownerConfirms) {
      return (
        <Bar>
          <Hint>
            {t(
              "The lowest option meets the minimum margin. Confirm it and you can quote straight away.",
            )}
          </Hint>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => sendCosting({ revisionId, note: "" }), "OK to quote.")
            }
          >
            <Check data-icon="inline-start" />
            {t("Confirm costing")}
          </Button>
        </Bar>
      );
    }
    if (status === "submitted") {
      return (
        <Hint>
          {t("Waiting for")} {approvers}{" "}
          {t(
            "to approve. You can still change it; once every option meets the minimum margin you can confirm it yourself.",
          )}
        </Hint>
      );
    }
    return (
      <Bar>
        <Hint>
          {readiness.costMissing
            ? `${t("Some lines have no cost keyed in, so")} ${approvers} ${t("must approve this costing.")}`
            : `${t("The lowest option is below the minimum margin. Raise the prices, or write why and send it to")} ${approvers}.`}
        </Hint>
        <NoteBox
          label={t("Reason (needed to send it)")}
          placeholder={t("Why should this go out below the minimum margin?")}
          value={note}
          onChange={setNote}
        />
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => sendCosting({ revisionId, note }),
              `${t("Sent to")} ${approvers} ${t("for approval.")}`,
            )
          }
        >
          <Send data-icon="inline-start" />
          {t("Send for approval")}
        </Button>
      </Bar>
    );
  }

  if (isOwner && status === "approved") {
    return (
      <Bar>
        <Hint>
          {t("OK to quote. You can send this quote to the customer.")}
        </Hint>
        {options.length > 1 && (
          <Select
            value={chosenOptionId ?? ""}
            disabled={pending}
            onValueChange={(optionId) =>
              run(
                () => chooseOption({ revisionId, optionId }),
                "Customer's option saved.",
              )
            }
          >
            <SelectTrigger aria-label={t("Customer's option")} className="w-64">
              <SelectValue
                placeholder={t("Which option did the customer choose?")}
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {t("Option")} {option.key}
                  {option.label ? ` · ${option.label}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isLatest && (
          <Button type="button" disabled={pending} onClick={revise}>
            <CopyPlus data-icon="inline-start" />
            {t("Open")} {nextRevisionName}
          </Button>
        )}
      </Bar>
    );
  }

  if (status === "submitted") {
    return (
      <Hint>
        {t("Below the minimum margin. Waiting for")} {approvers}{" "}
        {t("to approve.")}
      </Hint>
    );
  }
  return null;
}

function Bar({ children }: { children: ReactNode }) {
  return (
    <div className="flex basis-full flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="min-w-60 flex-1 text-sm text-muted-foreground">{children}</p>
  );
}

function NoteBox({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="min-w-60 flex-1">
      <FieldLabel htmlFor="approvalNote">{label}</FieldLabel>
      <Textarea
        id="approvalNote"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={1000}
      />
    </Field>
  );
}
