"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isViewingAs } from "@/lib/auth/impersonation";
import { languageCookieName } from "./current-language";
import { Language } from "./dictionary";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Switches the language for this browser. It is only a cookie, so it works while the MD views
 * as someone (nothing is saved to the database); the person's saved language changes in People.
 */
export async function setLanguage(formData: FormData) {
  const language = Language.safeParse(formData.get("language"));
  if (!language.success) return;

  const viewingAs = await isViewingAs();
  (await cookies()).set(languageCookieName(viewingAs), language.data, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // A view-as choice lasts until the browser closes, so it never reaches the next person viewed.
    ...(viewingAs ? {} : { maxAge: ONE_YEAR_SECONDS }),
  });
  revalidatePath("/", "layout");
}
