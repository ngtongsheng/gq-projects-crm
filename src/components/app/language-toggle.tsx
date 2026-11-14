import { Button } from "@/components/ui/button";
import { Language, LanguageLabel } from "@/lib/i18n/dictionary";
import { setLanguage } from "@/lib/i18n/language-actions";

/** English / BM / 中文 switch for a page that has translated text (demo: the `seg` toggle). */
export function LanguageToggle({
  language,
  languages = Language.options,
}: {
  language: Language;
  /** The languages this page has text for; Costing has no BM, Log work has no 中文. */
  languages?: readonly Language[];
}) {
  return (
    <form action={setLanguage} className="print:hidden">
      <fieldset
        aria-label="Language"
        className="inline-flex gap-1 rounded-lg border border-border bg-sunk p-1"
      >
        {languages.map((option) => (
          <Button
            key={option}
            type="submit"
            name="language"
            value={option}
            size="sm"
            variant={option === language ? "default" : "ghost"}
            aria-pressed={option === language}
          >
            {LanguageLabel[option]}
          </Button>
        ))}
      </fieldset>
    </form>
  );
}
