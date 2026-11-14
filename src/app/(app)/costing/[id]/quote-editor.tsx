"use client";

import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import type { QuoteView } from "../quote-view";
import { ItemTable } from "./item-table";
import { MarginPill } from "./margin-pill";
import { Labeled, NumberBox } from "./number-box";
import { OptionCard, type OptionSummary } from "./option-card";
import {
  type Draft,
  type DraftOption,
  draftFromRevision,
  payloadOf,
  previewOption,
  rateForMargin,
} from "./quote-draft";
import { addOption, removeOption, saveRevision } from "./revision-actions";

type Revision = QuoteView["revisions"][number];

const toNumber = (value: string) => (value.trim() === "" ? 0 : Number(value));

function usesLandedCost(item: DraftOption["items"][number]) {
  return (
    item.type === "import" || (item.type === "rug" && item.rugMode === "area")
  );
}

export function QuoteEditor({
  revision,
  costShown,
  canEdit,
  lockNote,
  initialOptionKey,
  children,
}: {
  revision: Revision;
  /** Whether this person sees cost and margin (loop 13 D3). */
  costShown: boolean;
  canEdit: boolean;
  /** Why the costing is read-only for this person, when it is. */
  lockNote: string | null;
  initialOptionKey: string | null;
  /** Extra buttons beside Save: the approval flow. Hidden while there are unsaved changes, since
   * the approval steps act on the saved costing. */
  children?: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved] = useState(() => draftFromRevision(revision));
  const [draft, setDraft] = useState<Draft>(saved);
  const [selectedKey, setSelectedKey] = useState(
    initialOptionKey ?? revision.options[0]?.key ?? null,
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const selected =
    draft.options.find((option) => option.key === selectedKey) ??
    draft.options[0];
  const disabled = !canEdit || pending;
  const defaults = { fxUsd: draft.fxUsd, sstPct: draft.sstPct };

  const setOption = (
    id: string,
    change: (option: DraftOption) => DraftOption,
  ) =>
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === id ? change(option) : option,
      ),
    }));

  const summaries: OptionSummary[] = draft.options.map((option, index) => {
    const totals = previewOption(option);
    const base = {
      key: option.key,
      label: option.label,
      itemCount: option.items.length,
      sell: totals.sell,
      chosen: revision.chosenOptionId === option.id,
    };
    if (costShown) {
      return {
        ...base,
        costShown: true,
        cost: totals.cost,
        profit: totals.profit,
        margin: totals.margin,
      };
    }
    return {
      ...base,
      costShown: false,
      level: dirty ? "unsaved" : (revision.options[index]?.marginLevel ?? null),
    };
  });
  const selectedSummary = summaries.find((s) => s.key === selected?.key);

  function save() {
    startTransition(async () => {
      const result = await saveRevision(payloadOf(revision.id, draft));
      if (result.error) {
        toast.error(t(result.error));
        return;
      }
      toast.success(t("Saved."));
      // The page loads again with the saved lines, which starts this editor over from them.
      router.refresh();
    });
  }

  function add(copyFromOptionId: string | null) {
    startTransition(async () => {
      const result = await addOption({
        revisionId: revision.id,
        copyFromOptionId,
      });
      if (result.error) {
        toast.error(t(result.error));
        return;
      }
      toast.success(
        copyFromOptionId
          ? `${t("Option")} ${result.optionKey} ${t("started as a copy. Change its products and prices.")}`
          : `${t("Option")} ${result.optionKey} ${t("added.")}`,
      );
      router.push(`?rev=${revision.rev}&option=${result.optionKey}`);
      router.refresh();
    });
  }

  function remove(optionId: string) {
    startTransition(async () => {
      const result = await removeOption({ optionId });
      setConfirmingRemove(false);
      if (result.error) {
        toast.error(t(result.error));
        return;
      }
      router.push(`?rev=${revision.rev}`);
      router.refresh();
    });
  }

  function applyRatesToImports() {
    let count = 0;
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) => ({
        ...option,
        items: option.items.map((item) => {
          if (!usesLandedCost(item)) return item;
          count += 1;
          const fx = item.currency === "RMB" ? current.fxRmb : current.fxUsd;
          return { ...item, fx, sstPct: current.sstPct };
        }),
      })),
    }));
    toast.success(
      count > 0
        ? `${t("Updated the rate and SST on")} ${count} ${t(count === 1 ? "imported line" : "imported lines")}.`
        : t("No imported lines to update."),
    );
  }

  function fillBlankRates() {
    const margin = toNumber(draft.targetMarginPct);
    if (!selected || margin <= 0 || margin >= 100) {
      toast.error(t("Key in a target margin between 0 and 100 first."));
      return;
    }
    let count = 0;
    setOption(selected.id, (option) => ({
      ...option,
      items: option.items.map((item, position) => {
        const blank = toNumber(item.rate) === 0;
        if (!blank || item.type === "discount") return item;
        count += 1;
        return { ...item, rate: String(rateForMargin(item, position, margin)) };
      }),
    }));
    toast.success(
      count > 0
        ? `${t("Filled")} ${count} ${t(count === 1 ? "blank rate" : "blank rates")} ${t("at")} ${margin}% ${t("margin, rounded up to whole RM.")}`
        : t("There are no blank rates."),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {costShown && (
        <section
          aria-label={t("Rates and margin")}
          className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3"
        >
          <NumberBox
            label={t("1 USD = RM")}
            value={draft.fxUsd}
            onChange={(fxUsd) => setDraft({ ...draft, fxUsd })}
            disabled={disabled}
          />
          <NumberBox
            label={t("1 RMB = RM")}
            value={draft.fxRmb}
            onChange={(fxRmb) => setDraft({ ...draft, fxRmb })}
            disabled={disabled}
          />
          <NumberBox
            label={t("SST %")}
            value={draft.sstPct}
            onChange={(sstPct) => setDraft({ ...draft, sstPct })}
            disabled={disabled}
            className="w-24"
          />
          <NumberBox
            label={t("Target margin %")}
            value={draft.targetMarginPct}
            onChange={(targetMarginPct) =>
              setDraft({ ...draft, targetMarginPct })
            }
            disabled={disabled}
            className="w-32"
          />
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyRatesToImports}
                disabled={disabled}
              >
                {t("Apply to all imported lines")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillBlankRates}
                disabled={disabled || !selected}
              >
                {t("Fill blank rates at target margin")}
              </Button>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {draft.options.map((option, index) => (
          <OptionCard
            key={option.id}
            option={summaries[index]}
            selected={option.id === selected?.id}
            onSelect={() => {
              setSelectedKey(option.key);
              setConfirmingRemove(false);
            }}
          />
        ))}
        {canEdit && selected && (
          <Button
            type="button"
            variant="outline"
            className="h-auto min-w-56 flex-1 flex-col gap-1 border-dashed p-3"
            disabled={pending || dirty}
            onClick={() => add(selected.id)}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Copy data-icon="inline-start" />
              {t("Add option")} {String.fromCharCode(65 + draft.options.length)}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {dirty
                ? t("Save your changes first")
                : `${t("Starts as a copy of option")} ${selected.key}`}
            </span>
          </Button>
        )}
      </div>

      {selected && selectedSummary ? (
        <section
          aria-label={`${t("Option")} ${selected.key}`}
          className="rounded-xl border bg-card"
        >
          <div className="flex flex-wrap items-end gap-3 border-b p-3">
            <h2 className="font-heading text-lg font-semibold">
              {t("Option")} {selected.key}
            </h2>
            <Labeled label={t("Option name")} className="w-72 max-w-full">
              <Input
                aria-label={t("Option name")}
                value={selected.label}
                onChange={(event) =>
                  setOption(selected.id, (option) => ({
                    ...option,
                    label: event.target.value,
                  }))
                }
                placeholder={t("e.g. Axminster 42oz")}
                maxLength={200}
                disabled={disabled}
              />
            </Labeled>
            {canEdit && draft.options.length > 1 && (
              <Button
                type="button"
                variant={confirmingRemove ? "destructive" : "ghost"}
                size="sm"
                className="ml-auto"
                disabled={pending || dirty}
                onClick={() => {
                  if (!confirmingRemove) return setConfirmingRemove(true);
                  remove(selected.id);
                }}
              >
                <Trash2 data-icon="inline-start" />
                {confirmingRemove
                  ? t("Click again to remove")
                  : dirty
                    ? t("Save first to remove")
                    : t("Remove this option")}
              </Button>
            )}
          </div>
          <ItemTable
            items={selected.items}
            costShown={costShown}
            disabled={disabled}
            defaults={defaults}
            onItemsChange={(items) =>
              setOption(selected.id, (option) => ({ ...option, items }))
            }
          />
          <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 border-t p-3 text-sm">
            {selectedSummary.costShown && (
              <>
                <Total label={t("Total cost")} value={selectedSummary.cost} />
                <Total label={t("Quote amount")} value={selectedSummary.sell} />
                <Total
                  label={t("Est. profit")}
                  value={selectedSummary.profit}
                />
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    {t("Margin")}
                  </span>
                  <MarginPill
                    costShown
                    margin={selectedSummary.margin}
                    level={null}
                  />
                </div>
              </>
            )}
            {!selectedSummary.costShown && (
              <>
                <Total label={t("Quote amount")} value={selectedSummary.sell} />
                {selectedSummary.level !== "unsaved" && (
                  <MarginPill
                    costShown={false}
                    margin={null}
                    level={selectedSummary.level}
                  />
                )}
              </>
            )}
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
          <p className="text-sm">
            {t(
              "This version has no option yet. Starting the costing did not finish.",
            )}
          </p>
          {canEdit && (
            <Button type="button" onClick={() => add(null)} disabled={pending}>
              <Plus data-icon="inline-start" />
              {t("Add option A")}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <>
            <Button type="button" onClick={save} disabled={pending || !dirty}>
              <Save data-icon="inline-start" />
              {pending ? t("Saving...") : t("Save")}
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {dirty ? t("You have unsaved changes.") : t("All changes saved.")}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{lockNote}</span>
        )}
        {!dirty && children}
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums">
        {formatRm(value)}
      </span>
    </div>
  );
}
