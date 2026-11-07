"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY, type Theme, themeSchema } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  try {
    const parsed = themeSchema.safeParse(
      localStorage.getItem(THEME_STORAGE_KEY),
    );
    return parsed.success ? parsed.data : "system";
  } catch {
    // Storage can be blocked (private windows); the system setting is the sensible fallback.
    return "system";
  }
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts as "system" so the server and first client render agree; the stored choice is read after mount.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const apply = (next: Theme) => {
      const resolved = resolve(next);
      document.documentElement.setAttribute("data-theme", resolved);
      setThemeState(next);
      setResolvedTheme(resolved);
    };

    apply(readStoredTheme());

    const media = matchMedia(DARK_QUERY);
    const onSystemChange = () => apply(readStoredTheme());
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) apply(readStoredTheme());
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not saved, but the choice still applies for this visit.
    }
    const resolved = resolve(next);
    document.documentElement.setAttribute("data-theme", resolved);
    setThemeState(next);
    setResolvedTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
