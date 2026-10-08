import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// Also read by the inline boot script in each app's index.html (prevents a theme flash).
export const THEME_STORAGE_KEY = "trans-theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStoredTheme(fallback: Theme): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : fallback;
  } catch {
    return fallback;
  }
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  // Kill transitions for one frame so colours don't animate on theme swap.
  root.setAttribute("data-theme-switching", "");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  requestAnimationFrame(() => root.removeAttribute("data-theme-switching"));
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  forcedTheme,
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  /** Overrides the user's choice (used by Storybook's toolbar). */
  forcedTheme?: ResolvedTheme;
}) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(defaultTheme));
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  useEffect(() => {
    const query = darkQuery();
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = forcedTheme ?? (theme === "system" ? (systemDark ? "dark" : "light") : theme);

  useEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the in-memory theme still works.
    }
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
