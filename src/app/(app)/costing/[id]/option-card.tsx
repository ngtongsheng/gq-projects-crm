import { StatusBadge } from "@/components/app/status-badge";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import type { MarginLevel } from "../quote-view";
import { MarginPill } from "./margin-pill";

export type OptionSummary = {
  key: string;
  label: string;
  itemCount: number;
  sell: number;
  chosen: boolean;
} & (
  | { costShown: true; cost: number; profit: number; margin: number | null }
  // The level is the server's, from the last save, so it is not shown while edits are unsaved.
  | { costShown: false; level: MarginLevel | "unsaved" }
);

/** One option's headline numbers; clicking it opens that option below. */
export function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: OptionSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-w-56 flex-1 flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {t("Option")} {option.key}
          {option.label ? ` · ${option.label}` : ""}
        </span>
        {option.chosen && (
          <StatusBadge tone="good">{t("Customer's pick")}</StatusBadge>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-xl font-semibold tabular-nums">
          {formatRm(option.sell)}
        </span>
        {option.costShown ? (
          <MarginPill costShown margin={option.margin} level={null} />
        ) : option.level === "unsaved" ? null : (
          <MarginPill costShown={false} margin={null} level={option.level} />
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm text-muted-foreground">
        {option.costShown && (
          <>
            <dt>{t("Total cost")}</dt>
            <dd className="text-right font-mono tabular-nums">
              {formatRm(option.cost)}
            </dd>
            <dt>{t("Est. profit")}</dt>
            <dd className="text-right font-mono tabular-nums">
              {formatRm(option.profit)}
            </dd>
          </>
        )}
        <dt>{t("Items")}</dt>
        <dd className="text-right font-mono tabular-nums">
          {option.itemCount}
        </dd>
      </dl>
    </button>
  );
}
