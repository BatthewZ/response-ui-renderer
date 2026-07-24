"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useMemo } from "react";

/**
 * Where `data-theme` is written.
 *
 * This is a real constraint of `@batthewz/response-ui-css`, not a preference.
 * Its built-in themes are authored `:root[data-theme="grimdark"]`, and `:root`
 * is `<html>` — so writing the attribute to a wrapper `<div>` matches nothing
 * and the theme silently does not apply.
 *
 * - `"root"`   — sets the attribute on `<html>`. Works with the built-in themes
 *                (default, events, grimdark, tech). Affects the whole document.
 * - `"scoped"` — sets it on the view's wrapper element. Themes the subtree only,
 *                but ONLY works for themes authored with a bare
 *                `[data-theme="…"]` selector. Built-in themes will not apply.
 *
 * `themeOverrides` is unaffected by this choice: inline custom properties
 * cascade to descendants regardless of selector, so it is always scoped and
 * always works.
 */
export type ThemeMode = "root" | "scoped";

/** Theme name meaning "no override layer" — the `:root` token set itself. */
export const DEFAULT_THEME = "default";

type ViewThemeScopeProps = {
  theme?: string;
  themeOverrides?: Record<string, string>;
  mode?: ThemeMode;
  className?: string;
  children: ReactNode;
};

/**
 * Root-mode claims, most recent last.
 *
 * A stack rather than a per-instance captured value, because two views can
 * overlap. With per-instance capture, unmounting the FIRST view restores the
 * attribute to what the document looked like before it mounted — wiping the
 * theme of a second view that is still on screen. Last claim wins; releasing a
 * claim falls back to the next one down, and finally to the host's own value.
 */
type RootClaim = { id: string; theme: string };

const claims: RootClaim[] = [];
let hostTheme: string | null = null;

function applyTopClaim(): void {
  const root = document.documentElement;
  const active = claims.length > 0 ? claims[claims.length - 1].theme : hostTheme;
  if (active != null && active !== DEFAULT_THEME) root.setAttribute("data-theme", active);
  else root.removeAttribute("data-theme");
}

function claimRoot(id: string, theme: string): void {
  // Capture the host's own theme once, on the first claim — not per instance.
  if (claims.length === 0) hostTheme = document.documentElement.getAttribute("data-theme");

  claims.push({ id, theme });

  if (claims.length > 1) {
    console.warn(
      `[response-ui-renderer] ${claims.length} views are applying a theme to <html> at once ` +
        `(${claims.map((claim) => claim.theme).join(", ")}); the most recently mounted wins. ` +
        `Use themeMode="scoped" with a bare [data-theme] theme, or themeOverrides, to theme ` +
        `views independently.`,
    );
  }

  applyTopClaim();
}

function releaseRoot(id: string): void {
  const index = claims.findIndex((claim) => claim.id === id);
  if (index === -1) return;
  claims.splice(index, 1);
  applyTopClaim();
  if (claims.length === 0) hostTheme = null;
}

/**
 * A view that declares no theme makes no claim at all. Removing the attribute
 * "because this view has no theme" would strip the theme off the entire host
 * application for as long as the renderer is mounted.
 */
function useRootTheme(theme: string | undefined, enabled: boolean): void {
  const id = useId();

  useEffect(() => {
    if (!enabled || theme == null || typeof document === "undefined") return;
    claimRoot(id, theme);
    return () => releaseRoot(id);
  }, [id, theme, enabled]);
}

/**
 * Only `--*` keys are applied. A document may legitimately try to set
 * `background`; honouring it would let a spec restyle arbitrary CSS rather than
 * re-point design tokens, which is the whole contract of a theme override.
 */
function toCustomProperties(
  overrides: Record<string, string> | undefined,
): CSSProperties | undefined {
  if (!overrides) return undefined;
  const style: Record<string, string> = {};
  let found = false;
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith("--") && typeof value === "string") {
      style[key] = value;
      found = true;
    }
  }
  return found ? style : undefined;
}

export function ViewThemeScope({
  theme,
  themeOverrides,
  mode = "root",
  className,
  children,
}: ViewThemeScopeProps) {
  useRootTheme(theme, mode === "root");

  const style = useMemo(() => toCustomProperties(themeOverrides), [themeOverrides]);
  const scopedTheme = mode === "scoped" && theme && theme !== DEFAULT_THEME ? theme : undefined;

  return (
    <div className={className} data-theme={scopedTheme} data-rui-view="" style={style}>
      {children}
    </div>
  );
}
