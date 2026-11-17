"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/language-context";
import type { MarketingView } from "./marketing-views";

/** The year shared by the dashboard and Vendors (demo #mkY). The year is in the address so a reload keeps it. */
export function MarketingYearSelect({
  years,
  year,
  view = "dashboard",
}: {
  years: readonly string[];
  year: string;
  view?: MarketingView;
}) {
  const t = useT();
  const router = useRouter();
  return (
    <Select
      value={year}
      onValueChange={(next) =>
        router.push(`/marketing?view=${view}&year=${next}`)
      }
    >
      <SelectTrigger aria-label={t("Year")} className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((value) => (
          <SelectItem key={value} value={value}>
            {value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
