import { EXAMPLE_THEMES } from "@batthewz/response-ui-react-components";
import { useEffect, useState } from "react";

import { DEFAULT_THEME, type ThemeMode } from "../src/index";

/** Dev harness only: the example themes are opt-in, and app.css imports them deliberately. */
export const SITE_THEMES = EXAMPLE_THEMES;

const THEME_KEY = "response-ui-renderer:theme";
const MODE_KEY = "response-ui-renderer:theme-mode";

const MODES: readonly ThemeMode[] = ["root", "scoped"];

/**
 * Held by the frame, and kept in storage as well.
 *
 * The frame outlives a link between pages, so state alone carries the choice
 * around the site; storage is what carries it across a reload, a bookmark and a
 * tab opened from scratch. Without that, a theme survives exactly as long as the
 * page you picked it on, and the feature reads as a toy on the playground rather
 * than something the whole site is wearing. Restored through the allowed list
 * rather than trusted: the value is whatever was last in storage, including a
 * theme name that has since stopped existing.
 */
function restore<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = localStorage.getItem(key);
  return allowed.some((value) => value === stored) ? (stored as T) : fallback;
}

export function useSiteTheme() {
  const [theme, setTheme] = useState<string>(() =>
    restore(THEME_KEY, SITE_THEMES, DEFAULT_THEME),
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    restore(MODE_KEY, MODES, "root"),
  );

  useEffect(() => localStorage.setItem(THEME_KEY, theme), [theme]);
  useEffect(() => localStorage.setItem(MODE_KEY, themeMode), [themeMode]);

  return { theme, setTheme, themeMode, setThemeMode };
}
