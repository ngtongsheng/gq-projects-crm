import { cookies } from "next/headers";
import { isViewingAs } from "@/lib/auth/impersonation";
import { Language } from "./dictionary";

const LANGUAGE_COOKIE = "gqp-language";
// While the MD views as someone, their own choice must not change what that person sees.
const VIEW_AS_LANGUAGE_COOKIE = "gqp-language-view-as";

export const languageCookieName = (viewingAs: boolean) =>
  viewingAs ? VIEW_AS_LANGUAGE_COOKIE : LANGUAGE_COOKIE;

/**
 * The language for this request: the toggle's choice for the session when there is one, else the
 * person's saved language.
 */
export async function resolveLanguage(
  profileLanguage: Language,
): Promise<Language> {
  const name = languageCookieName(await isViewingAs());
  const chosen = Language.safeParse((await cookies()).get(name)?.value);
  return chosen.success ? chosen.data : profileLanguage;
}
