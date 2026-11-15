import { BONUS_BANDS } from "@/lib/domain/hr-scheme";
import type { Translate } from "@/lib/i18n/translate";

/** The scheme's performance bonus, as a reference only: the app does not work bonuses out (loop 16 D2). */
export function BonusBands({ t }: { t: Translate }) {
  return (
    <>
      <ul className="divide-y rounded-lg border">
        {BONUS_BANDS.map((band) => (
          <li
            key={band.when}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="mr-auto min-w-0">{t(band.when)}</span>
            <span>{t(band.reward)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        <b>{t("Counted on the annual target and paid after year end.")}</b>{" "}
        {t(
          "Subject to project profitability, payment collection, individual performance, compliance, no unresolved customer or project issues, and management's final approval.",
        )}
      </p>
    </>
  );
}
