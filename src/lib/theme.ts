export type Theme = "light" | "dark";

/** Clave de localStorage. Debe coincidir con el script inline de `layout.tsx`. */
export const THEME_KEY = "lex-theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Preferencia guardada si existe; si no, la del sistema operativo. */
export function resolveTheme(): Theme {
  return getStoredTheme() ?? systemTheme();
}

/** Aplica el tema al <html> (clase `dark`). */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Persiste la elección explícita del usuario y la aplica. */
export function setTheme(theme: Theme) {
  window.localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
