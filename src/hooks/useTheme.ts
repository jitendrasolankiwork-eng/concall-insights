import { useState, useEffect } from "react";

export type Theme = "light" | "navy";
const STORAGE_KEY = "apt-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(STORAGE_KEY) as Theme) || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "navy") {
      root.setAttribute("data-theme", "navy");
    } else {
      root.removeAttribute("data-theme");
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
