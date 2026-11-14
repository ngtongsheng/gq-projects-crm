import { bm } from "./bm";
import type { Dictionary, Language } from "./dictionary";
import { zh } from "./zh";

const dictionaries: Record<Language, Dictionary> = { en: {}, bm, zh };

/**
 * The text in the person's language, or the English text itself when there is no translation
 * yet. Plain function so server and client components both call it; pass the language down.
 */
export function t(language: Language, text: string): string {
  const dictionary = dictionaries[language];
  return Object.hasOwn(dictionary, text) ? dictionary[text] : text;
}
