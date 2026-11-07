import { z } from "zod";

export const THEME_STORAGE_KEY = "theme";

export const themeSchema = z.enum(["light", "dark", "system"]);

export type Theme = z.infer<typeof themeSchema>;
