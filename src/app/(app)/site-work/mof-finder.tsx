"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/language-context";

export type MofFinderRow = {
  id: string;
  mofNo: string;
  projectName: string;
  companyName: string;
  salesperson: string;
  /** "Installation in progress 74%". */
  progress: string;
};

const MOST_SHOWN = 30;
const squash = (text: string) => text.toLowerCase().replace(/\s/g, "");

/** "MOF summary": key in a MOF number or project name, then open that job's page (demo: mofFind). */
export function MofFinder({ rows }: { rows: readonly MofFinderRow[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const wanted = squash(query);
  const found = rows
    .filter(
      (row) =>
        !wanted ||
        squash(row.mofNo).includes(wanted) ||
        squash(row.projectName).includes(wanted) ||
        squash(row.companyName).includes(wanted),
    )
    .slice(0, MOST_SHOWN);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{t("MOF summary")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("MOF summary")}</DialogTitle>
          <DialogDescription>
            {t(
              "Key in the MOF number or project name to see everything about that job in one page.",
            )}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("e.g. P1591 or Mont Kiara")}
          aria-label={t("MOF number or project name")}
        />
        {found.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("No MOF matches.")}
          </p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col divide-y overflow-y-auto rounded-lg border">
            {found.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/site-work/${row.id}`}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-sunk"
                >
                  <span className="font-mono text-sm font-semibold">
                    {row.mofNo}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">
                      {row.projectName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.companyName} · {row.salesperson} · {row.progress}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
