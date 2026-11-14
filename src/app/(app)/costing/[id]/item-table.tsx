"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/language-context";
import { CATEGORIES, CATEGORY_LABEL, isSupplyCategory } from "./item-kinds";
import { ItemRow } from "./item-row";
import {
  blankItem,
  changeCategory,
  changeSource,
  type DraftItem,
  followLinkedLines,
  previewItem,
} from "./quote-draft";

type Defaults = { fxUsd: string; sstPct: string };

/** The lines of one option, each with the boxes its kind of line needs, and the buttons to add more. */
export function ItemTable({
  items,
  costShown,
  disabled,
  defaults,
  onItemsChange,
}: {
  items: DraftItem[];
  costShown: boolean;
  disabled: boolean;
  /** The revision's USD rate and SST, which a new imported line starts with. */
  defaults: Defaults;
  onItemsChange: (items: DraftItem[]) => void;
}) {
  const t = useT();
  const replace = (index: number, next: DraftItem) =>
    onItemsChange(
      followLinkedLines(items.map((item, i) => (i === index ? next : item))),
    );

  const linkChoices = (own: DraftItem) =>
    items.flatMap((other, position) =>
      other.ref !== own.ref && isSupplyCategory(other.category)
        ? [
            {
              ref: other.ref,
              label: `#${position + 1} ${other.product || t("(no name)")}`,
            },
          ]
        : [],
    );

  return (
    <div className="flex flex-col">
      {items.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {t("No items yet.")}{" "}
          {disabled ? "" : t("Use the buttons below to add the first line.")}
        </p>
      )}
      {items.map((item, index) => (
        <ItemRow
          key={item.ref}
          index={index}
          item={item}
          costShown={costShown}
          disabled={disabled}
          totals={previewItem(item, index)}
          linkChoices={linkChoices(item)}
          onChange={(changes) => replace(index, { ...item, ...changes })}
          onChangeCategory={(category) =>
            replace(index, changeCategory(item, category, defaults))
          }
          onChangeSource={(source) =>
            replace(index, changeSource(item, source, defaults))
          }
          onRemove={() =>
            onItemsChange(
              followLinkedLines(items.filter((_, i) => i !== index)),
            )
          }
        />
      ))}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 border-t p-3">
          <span className="text-sm text-muted-foreground">
            {t("Add a line:")}
          </span>
          {CATEGORIES.map((category) => (
            <Button
              key={category}
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onItemsChange([
                  ...items,
                  blankItem(category, "local", defaults),
                ])
              }
            >
              <Plus data-icon="inline-start" />
              {t(CATEGORY_LABEL[category])}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
