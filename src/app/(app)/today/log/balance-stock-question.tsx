"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STOCK_RETURN_WAY_LABEL,
  STOCK_RETURN_WAYS,
} from "@/lib/domain/site-log";
import {
  emptyReturnItem,
  RETURN_UNITS,
  type ReturnItemDraft,
  type VisitDraft,
} from "@/lib/domain/site-visit-draft";
import { useT } from "@/lib/i18n/language-context";
import { ChoiceButton, Question, YesNo } from "./wizard-controls";

function ItemRow({
  row,
  removable,
  onChange,
  onRemove,
}: {
  row: ReturnItemDraft;
  removable: boolean;
  onChange: (changes: Partial<ReturnItemDraft>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <Input
        aria-label={t("Item")}
        placeholder={t("e.g. Carpet tile Grey 50×50")}
        value={row.item}
        maxLength={120}
        onChange={(event) => onChange({ item: event.target.value })}
        className="h-11 text-base"
      />
      <div className="grid grid-cols-[6rem_1fr_auto] items-center gap-2">
        <Input
          aria-label={t("Qty")}
          placeholder={t("Qty")}
          type="number"
          inputMode="numeric"
          min={1}
          value={row.qty}
          onChange={(event) => onChange({ qty: event.target.value })}
          className="h-11 font-mono text-base tabular-nums"
        />
        <Select value={row.unit} onValueChange={(unit) => onChange({ unit })}>
          <SelectTrigger aria-label={t("Unit")} className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETURN_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {removable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t("Remove")}
            onClick={onRemove}
          >
            <X />
          </Button>
        ) : (
          <span className="size-9" />
        )}
      </div>
    </div>
  );
}

/**
 * Balance stock: whether any is left on site, what, and how it goes back. A stock return
 * always lists the items. Nothing is stored per item yet, only the answer and the WhatsApp text.
 */
export function BalanceStockQuestion({
  draft,
  update,
  isStockReturn,
}: {
  draft: VisitDraft;
  update: (changes: Partial<VisitDraft>) => void;
  isStockReturn: boolean;
}) {
  const t = useT();
  const finishing =
    draft.installedPct === 100 || draft.activities.includes("handover");
  const lists = isStockReturn || draft.anyBalanceStock === true;
  const setRow = (index: number, changes: Partial<ReturnItemDraft>) =>
    update({
      returnItems: draft.returnItems.map((row, at) =>
        at === index ? { ...row, ...changes } : row,
      ),
    });

  return (
    <Question
      title={
        isStockReturn
          ? t("Which balance stock did you send back today?")
          : t("Any balance stock left on site to return?")
      }
      hint={
        isStockReturn
          ? t("Key in each item. Purchasing decides where it goes.")
          : finishing
            ? t("Job finishing: count all balance stock before you leave.")
            : t("Leftover boxes, rolls or offcuts that must go back.")
      }
      unanswered={!isStockReturn && draft.anyBalanceStock === null}
    >
      {!isStockReturn && (
        <YesNo
          value={draft.anyBalanceStock}
          onChange={(anyBalanceStock) => update({ anyBalanceStock })}
          yes={t("Yes, there is")}
          no={t("No balance stock")}
        />
      )}
      {lists && (
        <>
          <div className="flex flex-col gap-2">
            {draft.returnItems.map((row, index) => (
              <ItemRow
                key={row.id}
                row={row}
                removable={draft.returnItems.length > 1}
                onChange={(changes) => setRow(index, changes)}
                onRemove={() =>
                  update({
                    returnItems: draft.returnItems.filter(
                      (_, at) => at !== index,
                    ),
                  })
                }
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() =>
              update({ returnItems: [...draft.returnItems, emptyReturnItem()] })
            }
          >
            <Plus data-icon="inline-start" />
            {t("Another item")}
          </Button>
          <h4 className="text-sm font-semibold">{t("How will it go back?")}</h4>
          <div className="flex flex-col gap-2">
            {STOCK_RETURN_WAYS.map((way) => (
              <ChoiceButton
                key={way}
                on={draft.returnWay === way}
                onClick={() => update({ returnWay: way })}
                className="w-full"
              >
                {t(STOCK_RETURN_WAY_LABEL[way])}
              </ChoiceButton>
            ))}
          </div>
          <p className="text-sm font-semibold text-warn">
            {t(
              "After saving, WhatsApp the office with a photo of the balance stock.",
            )}
          </p>
        </>
      )}
    </Question>
  );
}
