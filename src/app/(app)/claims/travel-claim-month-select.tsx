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

/** The claim month picker; each month is a link target so the page stays shareable and reloadable. */
export function TravelClaimMonthSelect({
  months,
  value,
}: {
  months: readonly { month: string; label: string; href: string }[];
  value: string;
}) {
  const router = useRouter();
  const t = useT();
  return (
    <Select
      value={value}
      onValueChange={(month) => {
        const picked = months.find((option) => option.month === month);
        if (picked) router.push(picked.href);
      }}
    >
      <SelectTrigger aria-label={t("Claim month")} className="w-auto min-w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((option) => (
          <SelectItem key={option.month} value={option.month}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
