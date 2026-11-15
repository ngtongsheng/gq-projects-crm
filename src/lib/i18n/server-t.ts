import { resolveLanguage } from "./current-language";
import type { Language } from "./dictionary";
import { t } from "./t";
import type { Translate } from "./translate";

/** Server components and actions: the translator for the language this request speaks. */
export async function getT(profileLanguage: Language): Promise<Translate> {
  const language = await resolveLanguage(profileLanguage);
  return (text) => t(language, text);
}
