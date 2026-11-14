import { z } from "zod";

/** The language the app speaks to this person in. */
export const Language = z.enum(["en", "bm", "zh"]);
export type Language = z.infer<typeof Language>;

export const LanguageLabel: Record<Language, string> = {
  en: "English",
  bm: "Bahasa Melayu",
  zh: "中文",
};

/** English text to its translation. English is the source text, so it has no dictionary of its own. */
export type Dictionary = Readonly<Record<string, string>>;
