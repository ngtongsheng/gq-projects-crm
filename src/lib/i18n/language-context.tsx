"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { Language } from "./dictionary";
import { t } from "./t";
import type { Translate } from "./translate";

const LanguageContext = createContext<Language>("en");

/** Hands the page's language to client components, which cannot read the cookie themselves. */
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Client components: the translator for the person's language. */
export function useT(): Translate {
  const language = useContext(LanguageContext);
  return (text) => t(language, text);
}
