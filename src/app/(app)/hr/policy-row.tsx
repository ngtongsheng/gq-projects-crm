import { FileText } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  POLICY_CATEGORY_LABEL,
  type PolicyDocument,
} from "@/lib/domain/hr-policy";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { OpenPolicyButton } from "./open-policy-button";
import { PolicyDialog } from "./policy-dialog";

/** One policy document: what it is, whether it is Current or Older, and how to open it. */
export function PolicyRow({
  document,
  current,
  replaceable,
  today,
  t,
}: {
  document: PolicyDocument;
  current: boolean;
  replaceable: PolicyDocument[];
  today: string;
  t: Translate;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="mr-auto min-w-0">
        <p className="font-medium">{document.title}</p>
        <p className="text-sm text-muted-foreground">
          {t(POLICY_CATEGORY_LABEL[document.category])} · {t("version")}{" "}
          {document.version} · {t("effective")}{" "}
          {formatDate(document.effectiveOn)}
          {document.note ? ` · ${document.note}` : ""}
        </p>
      </div>
      <StatusBadge tone={current ? "good" : "neutral"}>
        {t(current ? "Current" : "Older")}
      </StatusBadge>
      {document.fileName ? (
        <OpenPolicyButton id={document.id} />
      ) : document.link ? (
        <Button asChild variant="outline" size="sm">
          <a href={document.link} target="_blank" rel="noopener noreferrer">
            {t("Open")}
          </a>
        </Button>
      ) : null}
      {current && (
        <PolicyDialog
          document={document}
          replaceable={replaceable}
          today={today}
        />
      )}
    </li>
  );
}
