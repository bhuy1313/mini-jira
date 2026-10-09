"use client";

import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from "next-themes";
import type { ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "mini-jira-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={STORAGE_KEY}
    >
      {children}
    </NextThemeProvider>
  );
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  return {
    theme: (theme as Theme | undefined) ?? "system",
    resolvedTheme: (resolvedTheme as ResolvedTheme | undefined) ?? "light",
    setTheme: (next: Theme) => setTheme(next),
  };
}

/** @deprecated next-themes injects its own blocking script; kept for compat. */
export const themeInitScript = "";
