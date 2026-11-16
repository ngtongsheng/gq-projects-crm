import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { daysBetween, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { installationHref } from "./installation-params";
import type { UnsignedDo } from "./unsigned-do-data";

/** Delivered DOs whose signed copy has not come back, each with the days waiting (demo: "DOs not yet signed & returned"). */
export function UnsignedDosPanel({
  t,
  dos,
  today,
}: {
  t: Translate;
  dos: UnsignedDo[];
  today: string;
}) {
  if (dos.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <h2 className="font-heading text-base font-medium">
          {t("DOs not yet signed & returned")}
        </h2>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {dos.length}
        </span>
      </div>
      <ul className="divide-y">
        {dos.map((unsigned) => (
          <li key={unsigned.jobId}>
            <Link
              href={installationHref({
                view: "week",
                date: unsigned.deliveredOn,
              })}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-sunk"
            >
              <span className="min-w-0">
                <span className="block font-medium">
                  {t("DO")}{" "}
                  <span className="font-mono tabular-nums">
                    {unsigned.doNo || t("not issued")}
                  </span>{" "}
                  · {unsigned.mofNo} {unsigned.projectName}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t("Delivered")} {formatDate(unsigned.deliveredOn)}
                  {unsigned.transporter && ` · ${unsigned.transporter}`}
                </span>
              </span>
              <StatusBadge tone="warn">
                {daysBetween(unsigned.deliveredOn, today)}d
              </StatusBadge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
