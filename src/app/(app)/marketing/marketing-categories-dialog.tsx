"use client";

import { ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/language-context";
import { saveMarketingCategories } from "./marketing-category-actions";
import type { MarketingCategory } from "./marketing-types";

type MarketingCategoriesDialogProps = {
  categories: readonly MarketingCategory[];
};

type Row = { id: string; name: string; used: number };

const toRows = (categories: readonly MarketingCategory[]): Row[] =>
  categories.map(({ id, name, used }) => ({ id, name, used }));

/** Adds, renames, reorders and deletes expense categories (demo sheetMkCats). Nothing is saved until Save. */
export function MarketingCategoriesDialog({
  categories,
}: MarketingCategoriesDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() => toRows(categories));

  function openChanged(next: boolean) {
    setOpen(next);
    if (!next) return;
    setError(null);
    setRows(toRows(categories));
  }

  const rename = (id: string, name: string) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, name } : row)),
    );
  const moveUp = (index: number) =>
    setRows((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  const remove = (id: string) =>
    setRows((current) => current.filter((row) => row.id !== id));
  const add = () =>
    setRows((current) => [
      ...current,
      { id: crypto.randomUUID(), name: t("New category"), used: 0 },
    ]);

  function save() {
    startTransition(async () => {
      const result = await saveMarketingCategories(
        rows.map(({ id, name }) => ({ id, name })),
      );
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Saved"));
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={openChanged}>
      <DialogTrigger asChild>
        <Button variant="outline">{t("Edit categories")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Expense categories")}</DialogTitle>
          <DialogDescription>
            {t(
              "Rename a category and its expenses follow. A category that expenses use cannot be deleted.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(event) => rename(row.id, event.target.value)}
                maxLength={100}
                aria-label={t("Category name")}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => moveUp(index)}
                aria-label={t("Move up")}
              >
                <ArrowUp />
              </Button>
              {row.used > 0 ? (
                <span className="w-16 text-right font-mono text-xs text-muted-foreground">
                  {row.used} {t("used")}
                </span>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-bad"
                  onClick={() => remove(row.id)}
                  aria-label={t("Delete category")}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
        {error && <FieldError>{t(error)}</FieldError>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? t("Saving...") : t("Save")}
          </Button>
          <Button type="button" variant="outline" onClick={add}>
            <Plus data-icon="inline-start" />
            {t("Add category")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
